import { Injectable, InternalServerErrorException } from '@nestjs/common';

/**
 * Google Calendar v3 REST 얇은 래퍼 — 라이브 Google 호출이 격리되는 seam.
 * (이 부분만 실제 구글 자격증명 없이는 E2E 검증 불가. 나머지 로직은 이 인터페이스에 의존.)
 * 의존성 추가 없이 raw fetch.
 */
export type GoogleEventResource = {
  summary: string;
  location?: string;
  description?: string;
  start: GoogleEventTime;
  end: GoogleEventTime;
  /** RFC5545 RRULE 배열 (반복 일정). 예: ['RRULE:FREQ=WEEKLY;INTERVAL=2'] */
  recurrence?: string[];
};

export type GoogleEventTime = { date: string } | { dateTime: string; timeZone?: string };

const BASE = 'https://www.googleapis.com/calendar/v3';

@Injectable()
export class GoogleCalendarClient {
  /** 교회 전용 캘린더 생성 → 캘린더 id. */
  async createCalendar(accessToken: string, summary: string): Promise<string> {
    const json = await this.call<{ id: string }>(accessToken, 'POST', `${BASE}/calendars`, { summary });
    return json.id;
  }

  /** 캘린더 삭제 (연동 해제 시 전용 캘린더 정리). */
  async deleteCalendar(accessToken: string, calendarId: string): Promise<void> {
    await this.call(accessToken, 'DELETE', `${BASE}/calendars/${encodeURIComponent(calendarId)}`);
  }

  async insertEvent(accessToken: string, calendarId: string, resource: GoogleEventResource): Promise<string> {
    const json = await this.call<{ id: string }>(
      accessToken,
      'POST',
      `${BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
      resource
    );
    return json.id;
  }

  async updateEvent(accessToken: string, calendarId: string, googleEventId: string, resource: GoogleEventResource): Promise<void> {
    await this.call(
      accessToken,
      'PUT',
      `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
      resource
    );
  }

  async deleteEvent(accessToken: string, calendarId: string, googleEventId: string): Promise<void> {
    await this.call(
      accessToken,
      'DELETE',
      `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`
    );
  }

  private async call<T = unknown>(accessToken: string, method: string, url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    // DELETE 는 204 + 빈 본문.
    if (res.status === 204) return undefined as T;
    const json = (await res.json().catch(() => ({}))) as T;
    if (!res.ok) {
      throw new InternalServerErrorException(`Google Calendar API ${method} ${res.status}: ${JSON.stringify(json)}`);
    }
    return json;
  }
}
