import { addDays, daysBetween, toDateString, todayString } from './date';

// jest-env.js 가 TZ=Asia/Seoul 로 띄운다 — 운영(Render)과 같은 조건.
describe('date (로컬 날짜 기준)', () => {
  afterEach(() => jest.useRealTimers());

  it('한국 시간 새벽(UTC 로는 전날)에도 오늘 날짜를 준다 — toISOString 을 쓰면 어제가 된다 (HANDOFF §3.3)', () => {
    jest.useFakeTimers({ now: new Date('2026-10-14T16:30:00Z') }); // KST 10-15 01:30
    expect(todayString()).toBe('2026-10-15');
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-10-14');
  });

  it('toDateString 은 문자열이면 앞 10자리, Date 면 로컬 날짜', () => {
    expect(toDateString('2026-03-01T12:00:00Z')).toBe('2026-03-01');
    expect(toDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('daysBetween 은 날짜 차이, 거꾸로면 0', () => {
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2);
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
    expect(daysBetween('2026-03-01', '2026-02-27')).toBe(0);
  });

  it('addDays 는 월·연 경계를 넘는다', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });
});
