import { addDays, toDateString } from '@src/common/date';
import { CalendarEventEntity } from '@src/database/entities/calendar-event.entity';
import { isRecurrence, toRRule } from '@src/module/calendar/recurrence';
import { GoogleEventResource } from './google-calendar.client';

/** 시각 일정에 붙이는 시간대. 반복 일정은 이게 없으면 구글이 400 으로 거절한다. 서버는 TZ=Asia/Seoul 로 돈다. */
export const EVENT_TIME_ZONE = 'Asia/Seoul';

/**
 * 앱 일정 → Google Calendar event resource.
 *
 * 종일 일정은 웹이 "그날 0시(한국 시간)"로 저장한다. 날짜를 `toISOString()` 으로 자르면 UTC 로 바뀌어
 * 전날(15:00Z)이 되므로 반드시 로컬 날짜(toDateString)로 뽑는다 (HANDOFF §3.3).
 * 구글 종일 일정의 end.date 는 배타적(exclusive)이라 종료일 + 1일.
 */
export function toGoogleEvent(event: CalendarEventEntity): GoogleEventResource {
  const recurrence = isRecurrence(event.recurrence) ? [toRRule(event.recurrence)] : undefined;
  const base = { summary: event.title, location: event.location, description: event.description, recurrence };

  if (event.allDay) {
    const start = toDateString(event.startAt);
    const last = toDateString(event.endAt ?? event.startAt);
    return { ...base, start: { date: start }, end: { date: addDays(last, 1) } };
  }

  const endAt = event.endAt ?? new Date(event.startAt.getTime() + 60 * 60 * 1000);
  return {
    ...base,
    start: { dateTime: event.startAt.toISOString(), timeZone: EVENT_TIME_ZONE },
    end: { dateTime: endAt.toISOString(), timeZone: EVENT_TIME_ZONE },
  };
}
