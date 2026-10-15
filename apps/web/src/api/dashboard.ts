async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

export type HomeScheduleItem = {
  id: number;
  title: string;
  startAt: string;
  allDay: boolean;
  layer: string;
  color: string;
};

export type HomeActivityItem = {
  kind: 'offering' | 'member' | 'transaction' | 'training' | 'missionary';
  who: string;
  what: string;
  at: string;
};

/** 양성 파이프라인 분포 — 재적상태(단계)별 인원. */
export type PipelineStage = {
  statusId: number;
  name: string;
  count: number;
};

export type OngoingCohort = {
  cohortId: number;
  label: string;
  startDate: string;
  enrolledCount: number;
  sessionCount: number;
};

export type HomeDashboard = {
  stats: {
    activeMissionaries: number;
    commissionedThisYear: number;
    ongoingCohorts: number;
    completedThisYear: number;
  };
  pipeline: PipelineStage[];
  training: OngoingCohort[];
  schedule: HomeScheduleItem[];
  activity: HomeActivityItem[];
};

export const fetchHomeDashboard = () => getJson<HomeDashboard>('/api/dashboard');
