const BASE = '/api/missionaries';

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

/**
 * 선교사 단계는 교회별 기준정보다 — 프론트에 이름을 하드코딩하지 않는다.
 * `countsAsActive` 만 코드가 아는 규약(현재 파송 집계·출석 명단 제외 기준).
 */
export type MissionaryStage = {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  countsAsActive: boolean;
};

export type Missionary = {
  id: number;
  memberId: number;
  memberName: string;
  stageId: number | null;
  stageName: string | null;
  stageCountsAsActive: boolean;
  country: string | null;
  region: string | null;
  fieldWork: string | null;
  ministryId: number | null;
  ministryName: string | null;
  commissionedAt: string | null;
  departedAt: string | null;
  endedAt: string | null;
  note: string | null;
};

export type MissionaryNote = {
  id: number;
  content: string;
  stageId: number | null;
  stageName: string | null;
  date: string;
  recorderName: string | null;
  createdAt: string;
};

export type MissionarySummary = {
  active: number;
  commissionedThisYear: number;
  byStage: { stageId: number | null; name: string; count: number; countsAsActive: boolean }[];
};

// ─── 단계 기준정보 ───────────────────────────────────────────

export const listStages = () => request<MissionaryStage[]>(`${BASE}/stages`);

export const createStage = (payload: { name: string; countsAsActive?: boolean; sortOrder?: number }) =>
  request<MissionaryStage>(`${BASE}/stages`, { method: 'POST', body: JSON.stringify(payload) });

export const updateStage = (
  id: number,
  payload: Partial<{ name: string; isActive: boolean; countsAsActive: boolean; sortOrder: number }>
) => request<MissionaryStage>(`${BASE}/stages/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const deleteStage = (id: number) => request<void>(`${BASE}/stages/${id}`, { method: 'DELETE' });

// ─── 선교사 ─────────────────────────────────────────────────

export const listMissionaries = (params?: { stageId?: number; scope?: 'active' | 'all' }) => {
  const query = new URLSearchParams();
  if (params?.stageId) query.set('stageId', String(params.stageId));
  if (params?.scope) query.set('scope', params.scope);
  const suffix = query.toString() ? `?${query}` : '';
  return request<Missionary[]>(`${BASE}${suffix}`);
};

export const fetchMissionarySummary = () => request<MissionarySummary>(`${BASE}/summary`);

export const fetchMissionaryDetail = (id: number) => request<Missionary & { notes: MissionaryNote[] }>(`${BASE}/${id}`);

export const fetchMissionaryByMember = (memberId: number) => request<Missionary | null>(`${BASE}/by-member/${memberId}`);

/** 기존 교인(memberId) 또는 명부에 없는 사람(newMember) 중 하나로 등록. */
export const createMissionary = (payload: {
  memberId?: number;
  newMember?: { name: string; phone?: string };
  stageId?: number;
  country?: string;
  region?: string;
  fieldWork?: string;
}) => request<Missionary>(BASE, { method: 'POST', body: JSON.stringify(payload) });

export const updateMissionary = (
  id: number,
  payload: Partial<{ stageId: number; country: string; region: string; fieldWork: string; note: string }>
) => request<Missionary>(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const removeMissionary = (id: number) => request<void>(`${BASE}/${id}`, { method: 'DELETE' });

// ─── 기록(메모) ─────────────────────────────────────────────

export const listNotes = (id: number) => request<MissionaryNote[]>(`${BASE}/${id}/notes`);

/** 메모가 본체. `stageId` 를 함께 주면 현재 단계도 그 값으로 옮겨진다. */
export const addNote = (id: number, payload: { content: string; stageId?: number; date?: string }) =>
  request<MissionaryNote>(`${BASE}/${id}/notes`, { method: 'POST', body: JSON.stringify(payload) });

export const deleteNote = (id: number, noteId: number) => request<void>(`${BASE}/${id}/notes/${noteId}`, { method: 'DELETE' });
