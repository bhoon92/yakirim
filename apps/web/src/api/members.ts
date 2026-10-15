export type Member = {
  id: number;
  churchId: number;
  name: string;
  phone: string | null;
  birth: string | null;
  statusId: number;
  statusName: string | null;
  note: string | null;
  registeredAt: string | null;
  baptizedAt: string | null;
  confirmedAt: string | null;
  previousChurch: string | null;
  faithYears: number | null;
  registrationReason: string | null;
  occupation: string | null;
  address: string | null;
  rawDonorName: string | null;
  createdAt: string;
  updatedAt: string;
  /** 현재 사역 역할. 목록에서도 보여주려고 상세와 별개로 함께 내려온다. */
  position: MemberTag | null;
  departments: MemberAffiliationTag[];
  ministries: MemberAffiliationTag[];
  smallGroups: MemberAffiliationTag[];
  /** 지금 담당 간사. 없으면 null */
  shepherd: { residentId: number; name: string } | null;
};

/** `id` 는 기준정보 id — 태그 색을 정하는 값으로도 쓴다(상세와 같은 색이 되도록). */
export type MemberTag = { id: number; name: string | null };
export type MemberAffiliationTag = MemberTag & { isLeader: boolean };

/** 목록 전용 필드를 뺀 교인 한 건 — 생성 응답은 태그를 담지 않는다. */
export type MemberRow = Omit<Member, 'position' | 'departments' | 'ministries' | 'smallGroups' | 'shepherd'>;

export type MemberStatusCount = { id: number; name: string; count: number };
export type MemberCounts = { all: number; byStatus: MemberStatusCount[] };

export type ListMembersResponse = {
  items: Member[];
  total: number;
  page: number;
  pageSize: number;
  counts: MemberCounts;
};

export type AffiliationKind = 'department' | 'ministry' | 'smallGroup';

export type ListMembersQuery = {
  q?: string;
  statusId?: number;
  affiliationKind?: AffiliationKind;
  affiliationId?: number;
  /** 현재 단계에 기준 일수 이상 머물러 있는 교인만 */
  stalled?: boolean;
  /** 이 간사가 맡은 사람만 */
  shepherdResidentId?: number;
  /** 담당 간사가 없는 사람만 */
  noShepherd?: boolean;
  page?: number;
  pageSize?: number;
};

export async function listMembers(query: ListMembersQuery): Promise<ListMembersResponse> {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.statusId) params.set('statusId', String(query.statusId));
  if (query.affiliationKind && query.affiliationId) {
    params.set('affiliationKind', query.affiliationKind);
    params.set('affiliationId', String(query.affiliationId));
  }
  if (query.stalled) params.set('stalled', 'true');
  if (query.shepherdResidentId) params.set('shepherdResidentId', String(query.shepherdResidentId));
  else if (query.noShepherd) params.set('noShepherd', 'true');
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));

  const res = await fetch(`/api/members?${params}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`list members ${res.status}`);
  return res.json();
}

export type CreateMemberPayload = {
  name: string;
  phone?: string;
  birth?: string;
  statusId?: number;
  note?: string;
  previousChurch?: string;
  faithYears?: number;
  registrationReason?: string;
  occupation?: string;
  address?: string;
};

export async function createMember(payload: CreateMemberPayload): Promise<MemberRow> {
  const res = await fetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`create member ${res.status} ${text}`);
  }
  return res.json();
}

export type UpdateMemberPayload = Partial<Omit<CreateMemberPayload, 'phone'>> & { phone?: string | null };

// 수정 응답은 상세 조회와 같은 모양이다(서버가 findById 를 돌려준다).
export async function updateMember(id: number, payload: UpdateMemberPayload): Promise<MemberDetail> {
  const res = await fetch(`/api/members/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`update member ${res.status} ${text}`);
  }
  return res.json();
}

export async function deleteMember(id: number): Promise<void> {
  const res = await fetch(`/api/members/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`delete member ${res.status}`);
}

/**
 * 상세는 목록과 모양이 다르다 — 소속을 `affiliations` 로 묶고 `position` 은 이력까지 담는다.
 * 그래서 목록 전용 필드를 빼고 다시 붙인다(그냥 & 하면 position 타입이 충돌한다).
 */
export type MemberDetail = Omit<Member, 'position' | 'departments' | 'ministries' | 'smallGroups' | 'shepherd'> & {
  affiliations: {
    departments: AffiliationSummary[];
    ministries: AffiliationSummary[];
    smallGroups: AffiliationSummary[];
  };
  position: {
    current: PositionHistoryEntry | null;
    history: PositionHistoryEntry[];
  };
};

export type PositionHistoryEntry = {
  id: number;
  positionId: number;
  positionName: string | null;
  startDate: string;
  endDate: string | null;
  note: string | null;
  isCurrent: boolean;
};

export type AffiliationSummary = {
  id: number;
  referenceId: number;
  referenceName: string | null;
  startDate: string;
  isLeader: boolean;
  roleLabel: string | null;
};

export async function fetchMember(id: number): Promise<MemberDetail> {
  const res = await fetch(`/api/members/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`fetch member ${res.status}`);
  return res.json();
}

/** 재적상태 구간 하나 — 열려 있으면 endDate 가 null 이다. */
export type StatusPeriod = {
  id: number;
  statusId: number;
  statusName: string | null;
  startDate: string;
  endDate: string | null;
  /** 이 단계에 머문 일수 (열려 있으면 오늘까지) */
  days: number;
  reason: string | null;
};

/** 기준 일수를 넘겨 같은 단계에 머물러 있는 교인. */
export type StalledMember = {
  memberId: number;
  memberName: string;
  statusId: number;
  statusName: string;
  since: string;
  days: number;
  threshold: number;
};

export async function fetchStatusHistory(memberId: number): Promise<StatusPeriod[]> {
  const res = await fetch(`/api/members/${memberId}/status-history`, { credentials: 'include' });
  if (!res.ok) throw new Error(`fetch status history ${res.status}`);
  return res.json();
}

export async function fetchStalledMembers(limit?: number): Promise<StalledMember[]> {
  const query = limit ? `?limit=${limit}` : '';
  const res = await fetch(`/api/members/stalled${query}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`fetch stalled members ${res.status}`);
  return res.json();
}

// ── 파이프라인 보드 ──────────────────────
export type PipelineCard = {
  id: number;
  name: string;
  since: string | null;
  days: number | null;
  stalled: boolean;
  shepherdName: string | null;
};

export type PipelineColumn = {
  statusId: number;
  name: string;
  stallsAfterDays: number | null;
  count: number;
  stalledCount: number;
  /** 오래 머문 순으로 최대 50장 — 나머지는 count 로만 */
  members: PipelineCard[];
};

export async function fetchPipeline(): Promise<PipelineColumn[]> {
  const res = await fetch('/api/members/pipeline', { credentials: 'include' });
  if (!res.ok) throw new Error(`pipeline ${res.status}`);
  return res.json();
}
