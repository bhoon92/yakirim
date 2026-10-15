/** 반복 일정 규칙 — 애플 캘린더식 5종. null = 반복 없음. */
export const RECURRENCE_VALUES = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'] as const;
export type Recurrence = (typeof RECURRENCE_VALUES)[number];

type FreqInterval = { freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'; interval: number };

const RULE: Record<Recurrence, FreqInterval> = {
  daily: { freq: 'DAILY', interval: 1 },
  weekly: { freq: 'WEEKLY', interval: 1 },
  biweekly: { freq: 'WEEKLY', interval: 2 },
  monthly: { freq: 'MONTHLY', interval: 1 },
  yearly: { freq: 'YEARLY', interval: 1 },
};

export function isRecurrence(value: unknown): value is Recurrence {
  return typeof value === 'string' && (RECURRENCE_VALUES as readonly string[]).includes(value);
}

/** ical-generator repeating 옵션. */
export function toRepeating(recurrence: Recurrence): FreqInterval {
  return RULE[recurrence];
}

/** RFC5545 RRULE 본문 (Google Calendar recurrence / iCal 공용). */
export function toRRule(recurrence: Recurrence): string {
  const { freq, interval } = RULE[recurrence];
  return `RRULE:FREQ=${freq};INTERVAL=${interval}`;
}

/** 주어진 시각의 다음 occurrence (로컬 wall-time 기준 전진). */
export function nextOccurrence(date: Date, recurrence: Recurrence): Date {
  const next = new Date(date);
  switch (recurrence) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}
