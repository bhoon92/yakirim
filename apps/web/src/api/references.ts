export type ReferenceKind = 'department' | 'ministry' | 'smallGroup' | 'position' | 'worshipService' | 'memberStatus' | 'careNoteType';

export const REFERENCE_PATH: Record<ReferenceKind, string> = {
  department: 'departments',
  ministry: 'ministries',
  smallGroup: 'small-groups',
  position: 'positions',
  worshipService: 'worship-services',
  memberStatus: 'member-statuses',
  careNoteType: 'care-note-types',
};

export const REFERENCE_LABEL: Record<ReferenceKind, string> = {
  department: '기관',
  ministry: '사역팀',
  smallGroup: '공동체',
  position: '사역 역할',
  worshipService: '예배',
  memberStatus: '재적상태',
  careNoteType: '기록 종류',
};

// 연도별로 편성하는 reference (해마다 재편성). 나머지(사역 역할·예배)는 연도 무관 공통.
export const YEAR_SCOPED_KINDS = new Set<ReferenceKind>(['department', 'ministry', 'smallGroup']);

export type Reference = {
  id: number;
  churchId: number;
  year?: number;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  /** 재적상태 전용 — 코드가 참조하는 항목이라 삭제 불가(이름 변경·비활성화는 가능). */
  systemKey?: string | null;
  /** 재적상태 전용 — 이 단계에 며칠 이상 머무르면 정체로 볼지. null 이면 판정 안 함. */
  stallsAfterDays?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertReferencePayload = {
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  /** 재적상태 전용. null 을 보내면 정체 판정에서 제외한다. */
  stallsAfterDays?: number | null;
};

/**
 * 서버가 준 한국어 사유를 그대로 꺼낸다.
 *
 * 예전에는 `delete memberStatus 409` 같은 문자열만 남겨서, 화면에는 "삭제 실패: delete memberStatus 409"
 * 로 떴다. 정작 서버는 "이 상태인 교인이 62명 있어 삭제할 수 없습니다" 처럼 이유를 말해 주고 있었다.
 */
async function failure(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => null);
  const message =
    (Array.isArray(body?.error?.desc) ? body.error.desc.join('\n') : null) ??
    (typeof body?.message === 'string' ? body.message.replace(/^\w+Exception:\s*/, '') : null);
  return new Error(message || `${fallback} (${res.status})`);
}

export async function listReferences(kind: ReferenceKind, year?: number): Promise<Reference[]> {
  const query = year != null ? `?year=${year}` : '';
  const res = await fetch(`/api/${REFERENCE_PATH[kind]}${query}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`list ${kind} ${res.status}`);
  return res.json();
}

export async function createReference(kind: ReferenceKind, payload: UpsertReferencePayload, year?: number): Promise<Reference> {
  const query = year != null ? `?year=${year}` : '';
  const res = await fetch(`/api/${REFERENCE_PATH[kind]}${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await failure(res, '추가하지 못했습니다');
  return res.json();
}

// 이전 연도(fromYear) 구성을 새 연도(toYear)로 복제.
export async function copyReferenceYear(kind: ReferenceKind, fromYear: number, toYear: number): Promise<Reference[]> {
  const res = await fetch(`/api/${REFERENCE_PATH[kind]}/copy?from=${fromYear}&to=${toYear}`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw await failure(res, '복사하지 못했습니다');
  return res.json();
}

export async function updateReference(kind: ReferenceKind, id: number, payload: Partial<UpsertReferencePayload>): Promise<Reference> {
  const res = await fetch(`/api/${REFERENCE_PATH[kind]}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await failure(res, '수정하지 못했습니다');
  return res.json();
}

export async function deleteReference(kind: ReferenceKind, id: number): Promise<void> {
  const res = await fetch(`/api/${REFERENCE_PATH[kind]}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw await failure(res, '삭제하지 못했습니다');
}
