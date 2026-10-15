import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { CalendarEntity } from '@src/database/entities/calendar.entity';
import { CalendarEventEntity } from '@src/database/entities/calendar-event.entity';
import { GoogleCalendarSyncService } from '@src/module/google-calendar/sync.service';
import { CreateCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar-event.dto';
import { isRecurrence, nextOccurrence, type Recurrence } from './recurrence';

/** 펼쳐진 일정(occurrence). 반복 일정은 같은 id로 여러 날짜에 등장. */
export type CalendarEventView = {
  id: number;
  calendarId: number;
  title: string;
  location: string | null;
  description: string | null;
  allDay: boolean;
  startAt: string;
  endAt: string | null;
  recurrence: string | null;
};

// occurrence 무한 루프 방지 가드 (조회 범위는 보통 6주라 충분).
const MAX_OCCURRENCES = 750;

@Injectable()
export class CalendarEventService {
  constructor(private readonly sync: GoogleCalendarSyncService) {}

  private repo() {
    return DataSources.instance.getRepository(CalendarEventEntity);
  }

  /** 기간 내 일정 — 반복 일정은 occurrence 로 펼쳐서 반환. */
  async list(churchId: number, from: string, to: string): Promise<CalendarEventView[]> {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // 단발 일정은 [from,to] 안에서 시작한 것만, 반복 일정은 to 이전 시작분 전부(과거 시작도 펼침).
    const events = await this.repo()
      .createQueryBuilder('e')
      .where('e.churchId = :churchId', { churchId })
      .andWhere('e.startAt <= :to', { to: toDate })
      .andWhere(new Brackets(qb => qb.where('e.recurrence IS NOT NULL').orWhere('e.startAt >= :from', { from: fromDate })))
      .orderBy('e.startAt', 'ASC')
      .addOrderBy('e.id', 'ASC')
      .getMany();

    const views: CalendarEventView[] = [];
    for (const event of events) {
      for (const occurrenceStart of this.occurrences(event, fromDate, toDate)) {
        views.push(this.toView(event, occurrenceStart));
      }
    }
    views.sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id - b.id);
    return views;
  }

  async create(churchId: number, dto: CreateCalendarEventDto): Promise<CalendarEventEntity> {
    await this.assertCalendar(churchId, dto.calendarId);
    const row = this.repo().create({
      churchId,
      calendarId: dto.calendarId,
      title: dto.title,
      location: dto.location,
      description: dto.description,
      allDay: dto.allDay ?? false,
      startAt: new Date(dto.startAt),
      endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      recurrence: dto.recurrence,
    });
    const saved = await this.repo().save(row);
    void this.sync.onEventCreated(saved); // best-effort, 비차단
    return saved;
  }

  async update(churchId: number, id: number, dto: UpdateCalendarEventDto): Promise<CalendarEventEntity> {
    const found = await this.repo().findOne({ where: { id, churchId } });
    if (!found) throw new NotFoundException('일정을 찾을 수 없습니다.');
    if (dto.calendarId) await this.assertCalendar(churchId, dto.calendarId);
    await this.repo().update(
      { id, churchId },
      {
        ...dto,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      }
    );
    const updated = (await this.repo().findOne({ where: { id, churchId } }))!;
    void this.sync.onEventUpdated(updated); // best-effort, 비차단
    return updated;
  }

  async remove(churchId: number, id: number): Promise<void> {
    const result = await this.repo().softDelete({ id, churchId });
    if (!result.affected) throw new NotFoundException('일정을 찾을 수 없습니다.');
    void this.sync.onEventDeleted(churchId, id); // best-effort, 비차단
  }

  /** event 의 [from,to] 내 occurrence 시작 시각 목록. */
  private occurrences(event: CalendarEventEntity, from: Date, to: Date): Date[] {
    if (!isRecurrence(event.recurrence)) {
      return event.startAt >= from && event.startAt <= to ? [event.startAt] : [];
    }
    const recurrence: Recurrence = event.recurrence;
    const result: Date[] = [];
    let cursor = new Date(event.startAt);
    let guard = 0;
    while (cursor <= to && guard < MAX_OCCURRENCES) {
      if (cursor >= from) result.push(new Date(cursor));
      cursor = nextOccurrence(cursor, recurrence);
      guard++;
    }
    return result;
  }

  private toView(event: CalendarEventEntity, occurrenceStart: Date): CalendarEventView {
    const durationMs = event.endAt ? event.endAt.getTime() - event.startAt.getTime() : null;
    const occurrenceEnd = durationMs !== null ? new Date(occurrenceStart.getTime() + durationMs) : null;
    return {
      id: event.id,
      calendarId: event.calendarId,
      title: event.title,
      location: event.location ?? null,
      description: event.description ?? null,
      allDay: event.allDay,
      startAt: occurrenceStart.toISOString(),
      endAt: occurrenceEnd ? occurrenceEnd.toISOString() : null,
      recurrence: event.recurrence ?? null,
    };
  }

  private async assertCalendar(churchId: number, calendarId: number): Promise<void> {
    const c = await DataSources.instance.getRepository(CalendarEntity).findOne({ where: { id: calendarId, churchId } });
    if (!c) throw new BadRequestException('달력을 찾을 수 없습니다.');
  }
}
