import type { EnrollmentStatus } from './training';

const BASE = '/api/residents';

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
 * 간사 트랙의 구간 — 노션 status 속성의 묶음처럼. 성도와 간사는 2트랙이라 간사는 진입 구간을 따로 거친다.
 */
export type ResidentPhase = 'preparing' | 'resident' | 'left';

export const RESIDENT_PHASE_LABEL: Record<ResidentPhase, string> = {
  preparing: '진입 준비',
  resident: '간사',
  left: '떠남',
};

/**
 * 간사 상태는 교회별 기준정보다 (지원/면담/…/활동/안식/퇴소) — 프론트에 이름을 하드코딩하지 않는다.
 * 코드가 아는 건 구간(phase)뿐이고, countsAsActive 는 phase === 'resident' 와 같다.
 */
export type ResidentStatus = {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  countsAsActive: boolean;
  phase: ResidentPhase;
};

export type ResidentTag = { id: number; name: string | null; isLeader: boolean };

export type Resident = {
  id: number;
  memberId: number;
  memberName: string;
  phone: string | null;
  statusId: number | null;
  statusName: string | null;
  statusCountsAsActive: boolean;
  statusPhase: ResidentPhase | null;
  joinedAt: string | null;
  committedAt: string | null;
  leftAt: string | null;
  note: string | null;
  /** 교인의 현재 소속·사역 역할을 그대로 읽은 것 — 편집은 교인 카드에서. */
  smallGroups: ResidentTag[];
  ministries: ResidentTag[];
  position: { id: number; name: string | null } | null;
  /** 맡은 사역 — 노션 다중 선택처럼 간사 화면에서 바로 붙이고 뗀다. */
  duties: ResidentDuty[];
  /** 과정별 대표 상태. 들은 적 없는 과정은 빠진다. */
  training: { courseId: number; status: EnrollmentStatus }[];
  /** 지금 맡은 성도 수. */
  flockCount: number;
};

export type ResidentDuty = { id: number; name: string };

export type ResidentDutyOption = ResidentDuty & { sortOrder: number; assignedCount: number };

export type ResidentHistory = {
  id: number;
  statusId: number;
  statusName: string | null;
  date: string;
  reason: string | null;
  recorderName: string | null;
};

export type ResidentSummary = {
  active: number;
  /** 진입 준비 중인 사람 — 아직 간사가 아니다 */
  preparing: number;
  byStatus: { statusId: number | null; name: string; count: number; countsAsActive: boolean; phase: ResidentPhase | null }[];
};

// ─── 상태 기준정보 ───────────────────────────────────────────

export const listResidentStatuses = () => request<ResidentStatus[]>(`${BASE}/statuses`);

export const createResidentStatus = (payload: { name: string; phase?: ResidentPhase; sortOrder?: number }) =>
  request<ResidentStatus>(`${BASE}/statuses`, { method: 'POST', body: JSON.stringify(payload) });

export const updateResidentStatus = (
  id: number,
  payload: Partial<{ name: string; isActive: boolean; phase: ResidentPhase; sortOrder: number }>
) => request<ResidentStatus>(`${BASE}/statuses/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const deleteResidentStatus = (id: number) => request<void>(`${BASE}/statuses/${id}`, { method: 'DELETE' });

// ─── 간사 ───────────────────────────────────────────────────

export const listResidents = (params?: { statusId?: number; scope?: 'active' | 'all' }) => {
  const query = new URLSearchParams();
  if (params?.statusId) query.set('statusId', String(params.statusId));
  if (params?.scope) query.set('scope', params.scope);
  const suffix = query.toString() ? `?${query}` : '';
  return request<Resident[]>(`${BASE}${suffix}`);
};

export const fetchResidentSummary = () => request<ResidentSummary>(`${BASE}/summary`);

export const fetchResidentDetail = (id: number) => request<Resident & { history: ResidentHistory[] }>(`${BASE}/${id}`);

/** 기존 교인(memberId) 또는 명부에 없는 사람(newMember) 중 하나로 등록. */
export const createResident = (payload: {
  memberId?: number;
  newMember?: { name: string; phone?: string };
  statusId?: number;
  joinedAt?: string;
  committedAt?: string;
}) => request<Resident>(BASE, { method: 'POST', body: JSON.stringify(payload) });

/** `statusId` 가 바뀌면 이력이 한 줄 쌓인다 — `statusReason`·`statusDate` 를 함께 보낼 수 있다. */
export const updateResident = (
  id: number,
  payload: Partial<{
    statusId: number;
    statusReason: string;
    statusDate: string;
    joinedAt: string;
    committedAt: string;
    leftAt: string;
    note: string;
  }>
) => request<Resident>(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const removeResident = (id: number) => request<void>(`${BASE}/${id}`, { method: 'DELETE' });

export const deleteResidentHistory = (id: number, historyId: number) =>
  request<void>(`${BASE}/${id}/history/${historyId}`, { method: 'DELETE' });

// ─── 맡은 사역 (노션 다중 선택) ──────────────────────────────

export const listResidentDuties = () => request<ResidentDutyOption[]>(`${BASE}/duties`);

/** 이름으로 붙인다 — 없는 이름이면 옵션이 새로 만들어진다. */
export const assignResidentDuty = (id: number, name: string) =>
  request<ResidentDuty>(`${BASE}/${id}/duties`, { method: 'POST', body: JSON.stringify({ name }) });

export const unassignResidentDuty = (id: number, dutyId: number) => request<void>(`${BASE}/${id}/duties/${dutyId}`, { method: 'DELETE' });

export const renameResidentDuty = (dutyId: number, name: string) =>
  request<ResidentDuty>(`${BASE}/duties/${dutyId}`, { method: 'PATCH', body: JSON.stringify({ name }) });

/** 옵션 삭제 — 붙어 있던 모든 간사에게서 함께 빠진다. */
export const deleteResidentDuty = (dutyId: number) => request<void>(`${BASE}/duties/${dutyId}`, { method: 'DELETE' });
