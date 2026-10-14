const BASE = '/api/shepherds';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${init?.method ?? 'GET'} ${url} ${res.status} ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** 담당 구간 하나. endDate 가 null 이면 지금 담당. */
export type ShepherdPeriod = {
  id: number;
  residentId: number;
  residentName: string | null;
  startDate: string;
  endDate: string | null;
};

/** 간사가 맡은 성도 한 명 — 연락한 지 오래된 사람이 위로 온다. */
export type FlockMember = {
  memberId: number;
  memberName: string;
  phone: string | null;
  statusName: string | null;
  since: string;
  lastCareNoteDate: string | null;
  daysSinceContact: number;
};

export const fetchMemberShepherd = (memberId: number) =>
  request<{ current: ShepherdPeriod | null; history: ShepherdPeriod[] }>(`${BASE}/members/${memberId}`);

/** 한 성도에 담당은 한 명. residentId null = 해제. */
export const setMemberShepherd = (memberId: number, residentId: number | null) =>
  request<{ changed: number }>(`${BASE}/members/${memberId}`, { method: 'PUT', body: JSON.stringify({ residentId }) });

export const fetchFlock = (residentId: number) => request<FlockMember[]>(`${BASE}/residents/${residentId}`);

/** 여러 명을 한 번에 맡긴다. 다른 간사 담당이던 사람은 옮겨온다. */
export const assignFlock = (residentId: number, memberIds: number[]) =>
  request<{ changed: number }>(`${BASE}/residents/${residentId}`, { method: 'POST', body: JSON.stringify({ memberIds }) });

/** 로그인한 계정의 "내가 맡은 사람". 계정이 간사와 연결돼 있지 않으면 residentId 가 null. */
export const fetchMyFlock = () => request<{ residentId: number | null; flock: FlockMember[] }>(`${BASE}/me`);
