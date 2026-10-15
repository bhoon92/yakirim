import { CalendarEventEntity } from '@src/database/entities/calendar-event.entity';
import { EVENT_TIME_ZONE, toGoogleEvent } from './google-event.mapper';

/** 웹이 보내는 것과 같은 방식으로 만든다 — 종일 일정은 `new Date('YYYY-MM-DDT00:00:00')` (한국 시간 0시). */
function event(partial: Partial<CalendarEventEntity>): CalendarEventEntity {
  return Object.assign(new CalendarEventEntity(), { id: 1, churchId: 1, calendarId: 1, title: '수련회', allDay: false, ...partial });
}

describe('toGoogleEvent', () => {
  // TZ=Asia/Seoul — 10/17 0시(KST)는 UTC 로 10/16 15:00. toISOString 으로 자르면 하루 앞당겨졌다.
  it('종일 일정은 한국 날짜 그대로, 끝은 다음 날(배타적)', () => {
    const resource = toGoogleEvent(event({ allDay: true, startAt: new Date('2026-10-17T00:00:00') }));
    expect(resource.start).toEqual({ date: '2026-10-17' });
    expect(resource.end).toEqual({ date: '2026-10-18' });
  });

  it('여러 날 종일 일정은 마지막 날 + 1일', () => {
    const resource = toGoogleEvent(
      event({ allDay: true, startAt: new Date('2026-10-17T00:00:00'), endAt: new Date('2026-10-19T00:00:00') })
    );
    expect([resource.start, resource.end]).toEqual([{ date: '2026-10-17' }, { date: '2026-10-20' }]);
  });

  // 구글은 반복 일정에 시간대가 없으면 400 으로 거절한다
  it('시각 일정은 시간대를 붙이고, 끝이 없으면 1시간', () => {
    const resource = toGoogleEvent(event({ startAt: new Date('2026-10-18T11:00:00'), recurrence: 'weekly' }));
    expect(resource.start).toEqual({ dateTime: '2026-10-18T02:00:00.000Z', timeZone: EVENT_TIME_ZONE });
    expect(resource.end).toEqual({ dateTime: '2026-10-18T03:00:00.000Z', timeZone: EVENT_TIME_ZONE });
    expect(resource.recurrence).toEqual(['RRULE:FREQ=WEEKLY;INTERVAL=1']);
  });

  it('반복이 아니면 recurrence 를 보내지 않는다', () => {
    expect(toGoogleEvent(event({ startAt: new Date('2026-10-18T11:00:00') })).recurrence).toBeUndefined();
  });
});
