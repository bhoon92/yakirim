export type RosterItem = {
  memberId: number;
  name: string;
  statusName: string | null;
  present: boolean;
};

export type Roster = {
  worshipServiceId: number;
  date: string;
  items: RosterItem[];
  present: number;
  total: number;
  rate: number;
};

export async function fetchRoster(worshipServiceId: number, date: string): Promise<Roster> {
  const params = new URLSearchParams({ worshipServiceId: String(worshipServiceId), date });
  const res = await fetch(`/api/attendance/roster?${params}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`roster ${res.status}`);
  return res.json();
}

export async function markAttendance(payload: {
  worshipServiceId: number;
  memberId: number;
  date: string;
  present: boolean;
}): Promise<{ present: boolean }> {
  const res = await fetch('/api/attendance/mark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`mark ${res.status} ${text}`);
  }
  return res.json();
}
