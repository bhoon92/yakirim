export type GoogleCalendarStatus =
  | { connected: false }
  | { connected: true; googleEmail: string; targetCalendarId: string; calendarId: number[] };

export async function fetchGoogleCalendarStatus(): Promise<GoogleCalendarStatus> {
  const res = await fetch('/api/google-calendar/status', { credentials: 'include' });
  if (!res.ok) throw new Error(`gcal status ${res.status}`);
  return res.json();
}

/** 동의 화면 URL — 받아서 top-level 이동(window.location)으로 OAuth 시작. */
export async function fetchGoogleCalendarConnectUrl(): Promise<string> {
  const res = await fetch('/api/google-calendar/connect', { credentials: 'include' });
  if (!res.ok) throw new Error(`gcal connect ${res.status}`);
  const json = (await res.json()) as { url: string };
  return json.url;
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const res = await fetch('/api/google-calendar', { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(`gcal disconnect ${res.status}`);
}

export async function syncGoogleCalendar(): Promise<{ pushed: number }> {
  const res = await fetch('/api/google-calendar/sync', { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error(`gcal sync ${res.status}`);
  return res.json();
}
