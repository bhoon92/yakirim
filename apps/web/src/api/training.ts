const BASE = '/api/training';

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

export type TrainingFormat = 'weekly' | 'retreat' | 'intensive' | 'etc';

export const TRAINING_FORMAT_LABEL: Record<TrainingFormat, string> = {
  weekly: '매주',
  retreat: '수련회',
  intensive: '합숙',
  etc: '기타',
};

export type CohortStatus = 'planned' | 'ongoing' | 'closed';

export const COHORT_STATUS_LABEL: Record<CohortStatus, string> = {
  planned: '예정',
  ongoing: '진행 중',
  closed: '종료',
};

export type EnrollmentStatus = 'enrolled' | 'completed' | 'dropped';

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  enrolled: '수강 중',
  completed: '수료',
  dropped: '중도포기',
};

export type TrainingCourse = {
  id: number;
  name: string;
  format: TrainingFormat;
  defaultSessionCount: number;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  /** 훈련 사다리 단계 번호. null = 사다리 밖 과정. */
  step: number | null;
  /** 수료 시 올리기를 제안할 재적상태 id. */
  completionStatusId: number | null;
  /** 수료 시 공동체 간사 등록을 제안할지. */
  completionSuggestsResident: boolean;
  /** 이 과정으로 열린 기수 수 — 있으면 지울 수 없고 숨기기만 된다. */
  cohortCount: number;
};

export type CoursePatch = Partial<{
  name: string;
  format: TrainingFormat;
  defaultSessionCount: number;
  isActive: boolean;
  step: number | null;
  completionStatusId: number | null;
  completionSuggestsResident: boolean;
}>;

export type Cohort = {
  id: number;
  courseId: number;
  courseName: string;
  /** 담당자가 직접 적는 기수 이름 — "5기" 여도 되고 "2026 봄학기" 여도 된다. */
  name: string;
  /** 목록 표시용 = `{과정명} {기수이름}` */
  label: string;
  startDate: string;
  endDate: string | null;
  status: CohortStatus;
  leaderMemberId: number | null;
  leaderName: string | null;
  sessionCount: number;
  enrolledCount: number;
  completedCount: number;
};

export type CohortSession = {
  id: number;
  sequence: number;
  date: string | null;
  topic: string | null;
};

export type CohortRosterItem = {
  enrollmentId: number;
  memberId: number;
  memberName: string;
  status: EnrollmentStatus;
  attendedSessionIds: number[];
  attendanceRate: number;
};

export type CohortDetail = {
  sessions: CohortSession[];
  roster: CohortRosterItem[];
};

export type MemberTrainingHistory = {
  enrollmentId: number;
  cohortId: number;
  courseName: string;
  name: string;
  label: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  closedAt: string | null;
  attendanceRate: number;
};

/** 사다리 과정(STEP 순) 먼저, 그다음 사다리 밖 과정(정렬순서). 과정이 보이는 모든 곳이 같은 순서를 쓴다. */
export function byLadder(a: TrainingCourse, b: TrainingCourse): number {
  if (a.step !== null && b.step !== null) return a.step - b.step || a.id - b.id;
  if (a.step !== null) return -1;
  if (b.step !== null) return 1;
  return a.sortOrder - b.sortOrder || a.id - b.id;
}

export const listCourses = () => request<TrainingCourse[]>(`${BASE}/courses`);

export const createCourse = (payload: { name: string; format?: TrainingFormat; defaultSessionCount?: number; description?: string }) =>
  request<TrainingCourse>(`${BASE}/courses`, { method: 'POST', body: JSON.stringify(payload) });

export const updateCourse = (id: number, payload: CoursePatch) =>
  request<TrainingCourse>(`${BASE}/courses/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

/** 기수가 있는 과정은 409 — 숨기기(isActive: false)를 쓴다. */
export const deleteCourse = (id: number) => request<void>(`${BASE}/courses/${id}`, { method: 'DELETE' });

export const listCohorts = (params?: { courseId?: number; status?: CohortStatus }) => {
  const query = new URLSearchParams();
  if (params?.courseId) query.set('courseId', String(params.courseId));
  if (params?.status) query.set('status', params.status);
  const suffix = query.toString() ? `?${query}` : '';
  return request<Cohort[]>(`${BASE}/cohorts${suffix}`);
};

export const createCohort = (payload: {
  courseId: number;
  /** 필수. 같은 과정 안에서 겹치면 409 가 온다. */
  name: string;
  startDate: string;
  endDate?: string;
  sessionCount?: number;
  leaderMemberId?: number;
}) => request<Cohort>(`${BASE}/cohorts`, { method: 'POST', body: JSON.stringify(payload) });

export const fetchCohortDetail = (cohortId: number) => request<CohortDetail>(`${BASE}/cohorts/${cohortId}`);

export const updateCohort = (
  cohortId: number,
  payload: Partial<{ name: string; status: CohortStatus; startDate: string; endDate: string }>
) => request<Cohort>(`${BASE}/cohorts/${cohortId}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const deleteCohort = (cohortId: number) => request<void>(`${BASE}/cohorts/${cohortId}`, { method: 'DELETE' });

export const updateSession = (sessionId: number, payload: { date?: string; topic?: string }) =>
  request<CohortSession>(`${BASE}/cohorts/sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const addSession = (cohortId: number) => request<CohortSession>(`${BASE}/cohorts/${cohortId}/sessions`, { method: 'POST' });

/** 회차 삭제 — 출석 기록도 함께 지워지고 남은 회차 번호가 1부터 다시 매겨진다. */
export const removeSession = (sessionId: number) => request<void>(`${BASE}/cohorts/sessions/${sessionId}`, { method: 'DELETE' });

export const markTrainingAttendance = (sessionId: number, enrollmentId: number, present: boolean) =>
  request<{ present: boolean }>(`${BASE}/cohorts/sessions/${sessionId}/attendance`, {
    method: 'POST',
    body: JSON.stringify({ enrollmentId, present }),
  });

export const enrollMembers = (cohortId: number, memberIds: number[]) =>
  request<{ added: number; skipped: number }>(`${BASE}/cohorts/${cohortId}/enrollments`, {
    method: 'POST',
    body: JSON.stringify({ memberIds }),
  });

export const updateEnrollmentStatus = (enrollmentId: number, status: EnrollmentStatus) =>
  request<unknown>(`${BASE}/enrollments/${enrollmentId}`, { method: 'PATCH', body: JSON.stringify({ status }) });

export const removeEnrollment = (enrollmentId: number) => request<void>(`${BASE}/enrollments/${enrollmentId}`, { method: 'DELETE' });

export const fetchMemberTrainingHistory = (memberId: number) => request<MemberTrainingHistory[]>(`${BASE}/members/${memberId}`);

// ─── 수료 → 단계 제안 ────────────────────────────────────────

/** 기수 수료자 중 과정이 정한 단계보다 아래에 있는 사람, 그리고 (과정이 제안하면) 아직 간사가 아닌 수료자. */
export type CohortPromotions = {
  target: { id: number; name: string } | null;
  candidates: { memberId: number; memberName: string; statusId: number; statusName: string | null; completedAt: string | null }[];
  suggestsResident: boolean;
  residentCandidates: { memberId: number; memberName: string }[];
};

export const fetchCohortPromotions = (cohortId: number) => request<CohortPromotions>(`${BASE}/cohorts/${cohortId}/promotions`);

/** 대상 여부는 서버가 다시 판단한다 — 이미 올라간 사람은 skipped. */
export const applyCohortPromotions = (cohortId: number, memberIds: number[]) =>
  request<{ promoted: number; skipped: number }>(`${BASE}/cohorts/${cohortId}/promotions`, {
    method: 'POST',
    body: JSON.stringify({ memberIds }),
  });
