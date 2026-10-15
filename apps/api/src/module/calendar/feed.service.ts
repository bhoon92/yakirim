import { Injectable } from '@nestjs/common';
import ical, { ICalEventRepeatingFreq } from 'ical-generator';
import { In } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { CalendarEntity } from '@src/database/entities/calendar.entity';
import { CalendarEventEntity } from '@src/database/entities/calendar-event.entity';
import { ChurchEntity } from '@src/database/entities/church.entity';
import { SubscriptionService } from './subscription.service';
import { isRecurrence, toRepeating } from './recurrence';

const TIMEZONE = 'Asia/Seoul';

@Injectable()
export class FeedService {
  constructor(private readonly subscriptions: SubscriptionService) {}

  /** 구독 토큰 → iCal(.ics) 문자열. 캘린더 앱이 구독하는 공개 피드. */
  async buildIcs(token: string): Promise<string> {
    const sub = await this.subscriptions.findByToken(token);
    const church = await DataSources.instance.getRepository(ChurchEntity).findOne({ where: { id: sub.churchId } });

    const cal = ical({
      name: `${church?.name ?? '교회'} 일정`,
      timezone: TIMEZONE,
      prodId: { company: 'yakirim', product: 'calendar', language: 'KO' },
    });

    const calendarIds = sub.calendarIds ?? [];
    if (calendarIds.length === 0) return cal.toString();

    // 포함 달력 (이름 표기용)
    const calendars = await DataSources.instance
      .getRepository(CalendarEntity)
      .find({ where: { id: In(calendarIds), churchId: sub.churchId } });
    const calendarNameMap = new Map(calendars.map(calendar => [calendar.id, calendar.name]));
    const validIds = calendars.map(calendar => calendar.id);
    if (validIds.length === 0) return cal.toString();

    // 과거 1년 ~ 미래 2년 일정 (피드 크기 제한)
    const now = new Date();
    const from = new Date(now.getFullYear() - 1, 0, 1);
    const to = new Date(now.getFullYear() + 2, 0, 1);

    const events = await DataSources.instance.getRepository(CalendarEventEntity).find({
      where: { churchId: sub.churchId, calendarId: In(validIds) },
      order: { startAt: 'ASC' },
    });

    for (const calendarEvent of events) {
      // 반복 일정은 RRULE 로 시리즈 전체를 표현하므로 과거 시작분도 포함(미래 to 초과만 제외).
      const rule = isRecurrence(calendarEvent.recurrence) ? toRepeating(calendarEvent.recurrence) : undefined;
      const repeating = rule ? { freq: ICalEventRepeatingFreq[rule.freq], interval: rule.interval } : undefined;
      if (calendarEvent.startAt > to) continue;
      if (!repeating && calendarEvent.startAt < from) continue;
      const end = calendarEvent.endAt ?? (calendarEvent.allDay ? undefined : new Date(calendarEvent.startAt.getTime() + 60 * 60 * 1000));
      cal.createEvent({
        id: `event-${calendarEvent.id}@yakirim`,
        start: calendarEvent.startAt,
        end,
        allDay: calendarEvent.allDay,
        repeating,
        summary: calendarEvent.title,
        location: calendarEvent.location ?? undefined,
        description:
          [
            calendarEvent.description,
            calendarNameMap.get(calendarEvent.calendarId) ? `[${calendarNameMap.get(calendarEvent.calendarId)}]` : null,
          ]
            .filter(Boolean)
            .join('\n') || undefined,
      });
    }

    return cal.toString();
  }
}
