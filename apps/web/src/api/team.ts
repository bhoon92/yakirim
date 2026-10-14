export type Role = 'owner' | 'admin' | 'staff' | 'shepherd' | 'viewer';

export const ROLE_LABEL: Record<Role, string> = {
  owner: '소유자',
  admin: '관리자',
  staff: '실무자',
  shepherd: '간사',
  viewer: '조회',
};

/** 역할을 고를 때 옆에 보여줄 한 줄 설명. */
export const ROLE_HINT: Record<Role, string> = {
  owner: '모든 권한',
  admin: '모든 권한 (재정 수정·팀 관리 포함)',
  staff: '재정 수정·팀 관리 빼고 전부 — 간사·설정까지 관리',
  shepherd: '교인·출석·훈련·양육기록·달력·갤러리. 설정·간사·선교사 관리는 보기만',
  viewer: '보기만 (양육기록 제외)',
};

/** 초대/변경 가능한 역할 (소유자 제외). */
export const ASSIGNABLE_ROLES: Role[] = ['admin', 'staff', 'shepherd', 'viewer'];

export type TeamMember = {
  membershipId: number;
  accountId: number;
  email: string;
  name: string;
  role: Role;
  pending: boolean;
  /** 이 계정이 교인 명부의 누구인지. 간사의 "내가 맡은 사람"이 이걸로 그 사람을 찾는다. */
  member: { id: number; name: string } | null;
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
    let message = `${res.status}`;
    try {
      const b = await res.json();
      if (b?.message) message = String(Array.isArray(b.message) ? b.message.join(', ') : b.message).replace(/^\w*Exception:\s*/, '');
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  // 본문 없는 200 도 있다(역할 변경·교인 연결 — Nest 가 void 를 200 으로 돌려준다).
  // 204 만 보고 json() 을 부르면 저장은 됐는데 화면은 "실패"로 보인다.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const listTeam = () => getJson<TeamMember[]>('/api/team');
export const inviteMember = (email: string, role: Role) => send<TeamMember>('POST', '/api/team/invite', { email, role });
export const updateMemberRole = (membershipId: number, role: Role) => send<void>('PATCH', `/api/team/${membershipId}`, { role });
/** 계정 ↔ 교인 연결. null 이면 해제. 한 교인은 한 계정에만 연결된다(409). */
export const linkTeamMember = (membershipId: number, memberId: number | null) =>
  send<void>('PATCH', `/api/team/${membershipId}/member`, { memberId });
export const removeMember = (membershipId: number) => send<void>('DELETE', `/api/team/${membershipId}`);
