export type Calendar = {
  id: number;
  name: string;
  color: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type CalendarEvent = {
  id: number;
  calendarId: number;
  title: string;
  location: string | null;
  description: string | null;
  allDay: boolean;
  startAt: string;
  endAt: string | null;
  recurrence: Recurrence | null;
};

export type Recurrence = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  daily: '매일',
  weekly: '매주',
  biweekly: '2주마다',
  monthly: '매월',
  yearly: '매년',
};

export type Subscription = {
  feedToken: string;
  calendarIds: number[];
  feedPath: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${url} ${res.status} ${text}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

// ── 달력(레이어) ─────────────────────────
export const listCalendars = () => getJson<Calendar[]>('/api/calendar/calendars');
export const createCalendar = (body: { name: string; color?: string }) => send<Calendar>('POST', '/api/calendar/calendars', body);
export const deleteCalendar = (id: number) => send<void>('DELETE', `/api/calendar/calendars/${id}`);

// ── 일정 ─────────────────────────────────
export const listEvents = (from: string, to: string) =>
  getJson<CalendarEvent[]>(`/api/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
export const createEvent = (body: {
  calendarId: number;
  title: string;
  location?: string;
  description?: string;
  allDay?: boolean;
  startAt: string;
  endAt?: string;
  recurrence?: Recurrence;
}) => send<CalendarEvent>('POST', '/api/calendar/events', body);
export const updateEvent = (
  id: number,
  body: {
    calendarId?: number;
    title?: string;
    location?: string | null;
    description?: string | null;
    allDay?: boolean;
    startAt?: string;
    endAt?: string | null;
    recurrence?: Recurrence | null;
  }
) => send<CalendarEvent>('PATCH', `/api/calendar/events/${id}`, body);
export const deleteEvent = (id: number) => send<void>('DELETE', `/api/calendar/events/${id}`);

// ── 구독 (iCal) ──────────────────────────
export const getSubscription = () => getJson<Subscription>('/api/calendar/subscription');
export const updateSubscription = (calendarIds: number[]) => send<Subscription>('PUT', '/api/calendar/subscription', { calendarIds });
export const regenerateSubscription = () => send<Subscription>('POST', '/api/calendar/subscription/regenerate');

/** 피드 절대 URL (현재 origin 기준). */
export const feedUrl = (sub: Subscription) => `${window.location.origin}${sub.feedPath}`;
