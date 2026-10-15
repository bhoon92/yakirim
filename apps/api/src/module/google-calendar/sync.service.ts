import { Injectable, Logger } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { CalendarEventEntity } from '@src/database/entities/calendar-event.entity';
import { GoogleCalendarConnectionEntity } from '@src/database/entities/google-calendar-connection.entity';
import { GoogleCalendarEventLinkEntity } from '@src/database/entities/google-calendar-event-link.entity';
import { GoogleCalendarConnectionService } from './connection.service';
import { GoogleCalendarClient, GoogleEventResource } from './google-calendar.client';
import { isRecurrence, toRRule } from '@src/module/calendar/recurrence';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 앱 일정 변경을 연결된 구글 캘린더로 push (단방향, best-effort).
 * 모든 메서드는 throw 하지 않음 — 캘린더 CRUD 본류를 막지 않기 위해 실패는 로깅만.
 */
@Injectable()
export class GoogleCalendarSyncService {
  private readonly logger = new Logger(GoogleCalendarSyncService.name);

  constructor(
    private readonly connections: GoogleCalendarConnectionService,
    private readonly client: GoogleCalendarClient
  ) {}

  private linkRepo() {
    return DataSources.instance.getRepository(GoogleCalendarEventLinkEntity);
  }

  async onEventCreated(event: CalendarEventEntity): Promise<void> {
    await this.fanout(event.churchId, async connection => {
      if (!this.shouldPush(connection, event)) return;
      await this.insert(connection, event);
    });
  }

  async onEventUpdated(event: CalendarEventEntity): Promise<void> {
    await this.fanout(event.churchId, async connection => {
      const link = await this.linkRepo().findOne({
        where: { connectionId: connection.id, calendarEventId: event.id },
      });
      const wanted = this.shouldPush(connection, event);
      if (wanted && link) {
        const token = await this.connections.validAccessToken(connection);
        await this.client.updateEvent(token, connection.targetCalendarId, link.googleEventId, this.toResource(event));
      } else if (wanted && !link) {
        await this.insert(connection, event);
      } else if (!wanted && link) {
        await this.deleteLink(connection, link);
      }
    });
  }

  async onEventDeleted(churchId: number, calendarEventId: number): Promise<void> {
    await this.fanout(churchId, async connection => {
      const link = await this.linkRepo().findOne({ where: { connectionId: connection.id, calendarEventId } });
      if (link) await this.deleteLink(connection, link);
    });
  }

  /** 연결 1건의 미래 일정 전체 backfill push (수동 동기화). */
  async backfill(connection: GoogleCalendarConnectionEntity): Promise<{ pushed: number }> {
    const events = await DataSources.instance.getRepository(CalendarEventEntity).find({
      where: { churchId: connection.churchId },
      order: { startAt: 'ASC' },
    });
    let pushed = 0;
    for (const calendarEvent of events) {
      if (!this.shouldPush(connection, calendarEvent)) continue;
      const existing = await this.linkRepo().findOne({
        where: { connectionId: connection.id, calendarEventId: calendarEvent.id },
      });
      if (existing) continue;
      try {
        await this.insert(connection, calendarEvent);
        pushed += 1;
      } catch (error) {
        this.logger.warn(`backfill push 실패 event=${calendarEvent.id}: ${String(error)}`);
      }
    }
    return { pushed };
  }

  private async insert(connection: GoogleCalendarConnectionEntity, event: CalendarEventEntity): Promise<void> {
    const token = await this.connections.validAccessToken(connection);
    const googleEventId = await this.client.insertEvent(token, connection.targetCalendarId, this.toResource(event));
    await this.linkRepo().save(this.linkRepo().create({ connectionId: connection.id, calendarEventId: event.id, googleEventId }));
  }

  private async deleteLink(connection: GoogleCalendarConnectionEntity, link: GoogleCalendarEventLinkEntity): Promise<void> {
    const token = await this.connections.validAccessToken(connection);
    await this.client.deleteEvent(token, connection.targetCalendarId, link.googleEventId);
    await this.linkRepo().delete({ id: link.id });
  }

  /** 연결마다 독립 실행 — 한 연결 실패가 다른 연결을 막지 않음. */
  private async fanout(churchId: number, handleConnection: (connection: GoogleCalendarConnectionEntity) => Promise<void>): Promise<void> {
    let activeConnections: GoogleCalendarConnectionEntity[] = [];
    try {
      activeConnections = await this.connections.activeForChurch(churchId);
    } catch (error) {
      this.logger.warn(`연결 조회 실패 church=${churchId}: ${String(error)}`);
      return;
    }
    for (const connection of activeConnections) {
      try {
        await handleConnection(connection);
      } catch (error) {
        this.logger.warn(`push 실패 connection=${connection.id}: ${String(error)}`);
      }
    }
  }

  private shouldPush(connection: GoogleCalendarConnectionEntity, event: CalendarEventEntity): boolean {
    return connection.calendarId.length === 0 || connection.calendarId.includes(event.calendarId);
  }

  /** CalendarEventEntity → Google Calendar event resource. */
  private toResource(event: CalendarEventEntity): GoogleEventResource {
    const recurrence = isRecurrence(event.recurrence) ? [toRRule(event.recurrence)] : undefined;
    const base = { summary: event.title, location: event.location, description: event.description, recurrence };
    if (event.allDay) {
      const start = this.toIsoDate(event.startAt);
      // Google 종일 일정의 end.date 는 배타적(exclusive) → 종료일 + 1일.
      const endSource = event.endAt ?? event.startAt;
      const end = this.toIsoDate(new Date(endSource.getTime() + DAY_MS));
      return { ...base, start: { date: start }, end: { date: end } };
    }
    const endAt = event.endAt ?? new Date(event.startAt.getTime() + 60 * 60 * 1000);
    return { ...base, start: { dateTime: event.startAt.toISOString() }, end: { dateTime: endAt.toISOString() } };
  }

  private toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
