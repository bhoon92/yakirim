/**
 * 날짜(YYYY-MM-DD) 유틸 — **로컬 시간대 기준**.
 *
 * `new Date().toISOString().slice(0, 10)` 은 UTC 로 변환하므로 TZ=Asia/Seoul 환경에서
 * 00:00~09:00 사이에 **어제 날짜**를 돌려준다. 새벽기도·심야 입력이 하루 밀려 기록되고,
 * 월 집계·"올해 파송" 같은 경계 계산이 조용히 어긋난다.
 * 웹은 lib/date.ts 로 이미 이 규칙을 지키고 있어 API 쪽도 같은 출처를 둔다.
 */

/** 오늘 (로컬 기준 YYYY-MM-DD). */
export function todayString(): string {
  return toDateString(new Date());
}

/** Date → 'YYYY-MM-DD' (로컬 기준). pg 드라이버가 date 컬럼을 Date 로 주는 경우까지 받는다. */
export function toDateString(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 'YYYY-MM-DD' 두 개 사이의 일수 (음수는 0으로). */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86400000));
}

/** 'YYYY-MM-DD' 에 일수를 더한다. 시각이 끼지 않는 순수 날짜 계산이라 UTC 로 해도 하루가 밀리지 않는다. */
export function addDays(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`) + days * 86400000;
  return new Date(time).toISOString().slice(0, 10);
}
