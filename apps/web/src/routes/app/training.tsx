import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { listMembers, type Member } from '@/api/members';
import {
  COHORT_STATUS_LABEL,
  ENROLLMENT_STATUS_LABEL,
  addSession,
  createCohort,
  deleteCohort,
  enrollMembers,
  fetchCohortDetail,
  fetchNextStepCandidates,
  fetchPendingPromotions,
  listCohorts,
  listCourses,
  markTrainingAttendance,
  removeEnrollment,
  removeSession,
  updateCohort,
  updateEnrollmentStatus,
  updateSession,
  byLadder,
  type Cohort,
  type CohortStatus,
  type EnrollmentStatus,
  type TrainingCourse,
} from '@/api/training';
import { PageHeader } from '@/components/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PanelToggle } from '@/components/ui/panel-toggle';
import { Card, CardContent } from '@/components/ui/card';
import { EmojiTile } from '@/components/ui/emoji-tile';
import { Input } from '@/components/ui/input';
import { todayString } from '@/lib/date';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { CourseManagerModal } from './course-manager';
import { CoursePicker } from './course-picker';
import { PromotionPanel } from './promotion-panel';

const STATUS_TONE: Record<CohortStatus, 'neutral' | 'muted' | 'success' | 'warn'> = {
  planned: 'neutral',
  ongoing: 'success',
  closed: 'muted',
};

const STATUS_FILTERS: (CohortStatus | 'all')[] = ['all', 'ongoing', 'planned', 'closed'];

export function TrainingPage() {
  const { can } = usePermissions();
  const canWrite = can('training:write');
  const [statusFilter, setStatusFilter] = useState<CohortStatus | 'all'>('all');
  // ?cohort=ID 로 들어오면 그 기수를 바로 연다 (대시보드 "놓친 제안"에서 넘어오는 길)
  const [searchParams, setSearchParams] = useSearchParams();
  const [openCohortId, setOpenCohortId] = useState<number | null>(() => Number(searchParams.get('cohort')) || null);
  const showCohort = (cohortId: number) => {
    setStatusFilter('all');
    setOpenCohortId(cohortId);
  };
  const closeCohort = () => {
    setOpenCohortId(null);
    if (searchParams.has('cohort')) setSearchParams({}, { replace: true });
  };
  const [creating, setCreating] = useState(false);
  const [managingCourses, setManagingCourses] = useState(false);

  const { data: courses = [] } = useQuery({ queryKey: ['training', 'courses'], queryFn: listCourses });
  const { data: cohorts = [], isLoading } = useQuery({
    queryKey: ['training', 'cohorts', statusFilter],
    queryFn: () => listCohorts(statusFilter === 'all' ? undefined : { status: statusFilter }),
  });
  const openCohortData = openCohortId !== null ? cohorts.find(item => item.id === openCohortId) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="양성"
        title="훈련"
        description="과정별 기수를 열고 회차 출석과 수료를 관리합니다."
        actions={
          canWrite && (
            <>
              <Button size="sm" variant="outline" onClick={() => setManagingCourses(true)}>
                <Settings2 className="size-4" />
                과정 관리
              </Button>
              <PanelToggle open={creating} onToggle={() => setCreating(!creating)} label="기수 개설" variant="default" />
            </>
          )
        }
      />

      {managingCourses && <CourseManagerModal onClose={() => setManagingCourses(false)} />}

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map(filter => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === filter
                ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
                : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
            )}
          >
            {filter === 'all' ? '전체' : COHORT_STATUS_LABEL[filter]}
          </button>
        ))}
      </div>

      <PendingPromotions onOpen={showCohort} />

      {creating && <CohortForm courses={courses} onClose={() => setCreating(false)} />}

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</p>
      ) : cohorts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <GraduationCap className="size-8 text-[var(--color-muted-foreground)]" />
            <p className="text-sm text-[var(--color-muted-foreground)]">아직 개설된 기수가 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {cohorts.map(cohort => (
            <button key={cohort.id} onClick={() => setOpenCohortId(cohort.id)} className="text-left">
              <Card className="h-full transition-colors hover:border-[var(--color-foreground)]">
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <EmojiTile seed={cohort.courseName} kind="training" size="sm" />
                      <p className="truncate font-semibold">{cohort.label}</p>
                    </div>
                    <Badge tone={STATUS_TONE[cohort.status]}>{COHORT_STATUS_LABEL[cohort.status]}</Badge>
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {cohort.startDate}
                    {cohort.endDate ? ` ~ ${cohort.endDate}` : ''}
                    {cohort.leaderName ? ` · 담당 ${cohort.leaderName}` : ''}
                  </p>
                  <p className="text-sm tabular-nums">
                    수강 {cohort.enrolledCount}명 · 수료 {cohort.completedCount}명 · {cohort.sessionCount}회차
                  </p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* 목록이 아직 안 왔거나 필터에 걸려 없으면 열지 않는다 */}
      {openCohortData && <CohortDetailModal cohort={openCohortData} onClose={closeCohort} />}
    </div>
  );
}

/**
 * 놓친 수료 제안 (planning 00.7 D) — 수료했는데 아직 올리지도 넘기지도 않은 사람이 있는 기수.
 * 누르면 그 기수가 열리고, 기수 화면 위쪽 제안 패널에서 바로 처리한다.
 */
function PendingPromotions({ onOpen }: { onOpen: (cohortId: number) => void }) {
  const { data = [] } = useQuery({ queryKey: ['training', 'promotions', 'pending'], queryFn: fetchPendingPromotions });
  if (data.length === 0) return null;
  return (
    <Card className="border-[#b9e5c0] bg-[#f3fbf4]">
      <CardContent className="space-y-2 py-3">
        <p className="text-sm font-semibold">수료 후 처리하지 않은 제안</p>
        <div className="flex flex-wrap gap-1.5">
          {data.map(row => {
            const count = new Set([...row.candidates, ...row.residentCandidates].map(person => person.memberId)).size;
            return (
              <button
                key={row.cohortId}
                onClick={() => onOpen(row.cohortId)}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1 text-xs font-medium hover:border-[var(--color-foreground)]"
              >
                {row.label} <span className="text-[var(--color-muted-foreground)] tabular-nums">{count}명</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CohortForm({ courses, onClose }: { courses: TrainingCourse[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState<number | null>(
    () => [...courses].filter(course => course.isActive).sort(byLadder)[0]?.id ?? null
  );
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayString());
  const [sessionCount, setSessionCount] = useState<string>('');

  const createMut = useMutation({
    mutationFn: () =>
      createCohort({
        courseId: courseId!,
        name: name.trim(),
        startDate,
        sessionCount: sessionCount ? Number(sessionCount) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training', 'cohorts'] });
      onClose();
    },
    // 같은 과정에 같은 이름이면 서버가 409 로 이유를 준다.
    onError: (error: Error) => window.alert(`기수 개설 실패: ${error.message}`),
  });

  const selected = courses.find(course => course.id === courseId);

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        {/* 노션 선택 속성처럼 — 없는 과정은 이름을 적어 바로 만들고, STEP·수료 시 단계도 이 칸에서 고친다 */}
        <CoursePicker value={courseId} onChange={setCourseId} />

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="기수 이름 (예: 5기 · 2026 봄학기)"
            value={name}
            onChange={event => setName(event.target.value)}
            maxLength={40}
            className="w-56"
            autoFocus
          />
          <Input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="w-40" />
          <Input
            type="number"
            min={1}
            placeholder={selected ? `회차 (기본 ${selected.defaultSessionCount})` : '회차'}
            value={sessionCount}
            onChange={event => setSessionCount(event.target.value)}
            className="w-44"
          />
        </div>

        <p className="text-xs text-[var(--color-muted-foreground)]">
          기수 이름은 직접 적습니다 — 목록에는{' '}
          <strong>
            {selected?.name ?? '과정'} {name.trim() || '…'}
          </strong>{' '}
          로 보입니다. 회차는 함께 생성되고 날짜·주제는 개설 후 채우면 됩니다.
        </p>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button size="sm" onClick={() => createMut.mutate()} disabled={!courseId || !name.trim() || createMut.isPending}>
            개설
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CohortDetailModal({ cohort, onClose }: { cohort: Cohort; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('training:write');
  const [enrolling, setEnrolling] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['training', 'cohort', cohort.id],
    queryFn: () => fetchCohortDetail(cohort.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['training', 'cohort', cohort.id] });
    queryClient.invalidateQueries({ queryKey: ['training', 'cohorts'] });
    queryClient.invalidateQueries({ queryKey: ['home', 'dashboard'] });
  };

  const attendanceMut = useMutation({
    mutationFn: (vars: { sessionId: number; enrollmentId: number; present: boolean }) =>
      markTrainingAttendance(vars.sessionId, vars.enrollmentId, vars.present),
    onSuccess: invalidate,
  });

  const enrollmentStatusMut = useMutation({
    mutationFn: (vars: { enrollmentId: number; status: EnrollmentStatus }) => updateEnrollmentStatus(vars.enrollmentId, vars.status),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`상태 변경 실패: ${error.message}`),
  });

  const removeEnrollmentMut = useMutation({
    mutationFn: (enrollmentId: number) => removeEnrollment(enrollmentId),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`수강 취소 실패: ${error.message}`),
  });

  const statusMut = useMutation({
    mutationFn: (status: CohortStatus) => updateCohort(cohort.id, { status }),
    onSuccess: invalidate,
  });

  const sessionMut = useMutation({
    mutationFn: (vars: { sessionId: number; date: string }) => updateSession(vars.sessionId, { date: vars.date }),
    onSuccess: invalidate,
  });

  const addSessionMut = useMutation({
    mutationFn: () => addSession(cohort.id),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`회차 추가 실패: ${error.message}`),
  });

  const removeSessionMut = useMutation({
    mutationFn: (sessionId: number) => removeSession(sessionId),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`회차 삭제 실패: ${error.message}`),
  });

  const deleteCohortMut = useMutation({
    mutationFn: () => deleteCohort(cohort.id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (error: Error) => window.alert(`기수 삭제 실패: ${error.message}`),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-[var(--color-background)] shadow-md"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="min-w-0">
            <EditableCohortName cohort={cohort} canWrite={canWrite} onSaved={invalidate} />
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {cohort.startDate}
              {cohort.endDate ? ` ~ ${cohort.endDate}` : ''} · 수강 {cohort.enrolledCount}명
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canWrite && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="기수 삭제"
                title="기수 삭제"
                disabled={deleteCohortMut.isPending}
                onClick={() => {
                  if (window.confirm(`"${cohort.label}" 기수를 삭제할까요?\n회차·수강·출석 기록이 함께 삭제됩니다.`)) {
                    deleteCohortMut.mutate();
                  }
                }}
              >
                <Trash2 className="text-[var(--color-destructive)]" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
              <X />
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-auto px-6 py-5">
          {canWrite && (
            <div className="flex flex-wrap items-center gap-2">
              {(['planned', 'ongoing', 'closed'] as CohortStatus[]).map(status => (
                <button
                  key={status}
                  onClick={() => statusMut.mutate(status)}
                  disabled={status === cohort.status}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    status === cohort.status
                      ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
                      : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
                  )}
                >
                  {COHORT_STATUS_LABEL[status]}
                </button>
              ))}
              <PanelToggle open={enrolling} onToggle={() => setEnrolling(!enrolling)} label="수강생 추가" />
              <Button size="sm" variant="ghost" onClick={() => addSessionMut.mutate()} disabled={addSessionMut.isPending}>
                <Plus className="size-3.5" />
                회차 추가
              </Button>
            </div>
          )}

          {enrolling && (
            <EnrollPanel
              cohortId={cohort.id}
              enrolledMemberIds={(detail?.roster ?? []).map(row => row.memberId)}
              onDone={() => {
                invalidate();
                setEnrolling(false);
              }}
            />
          )}

          {/* 수료 처리하면 여기 뜬다 — 표가 길어도 바로 보이게 위쪽에 둔다 */}
          <PromotionPanel cohortId={cohort.id} />

          {isLoading || !detail ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</p>
          ) : detail.roster.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">아직 수강생이 없습니다.</p>
          ) : (
            /*
             * 60명 × 12회차면 가로·세로로 다 넘친다. 스크롤하면 "누구의 몇 회차인지"를 잃어버려서
             * 체크박스를 잘못 누르기 쉽다 — 머리글 행과 이름 열을 고정한다.
             * 두 축을 한 컨테이너에서 스크롤해야 sticky 기준이 하나로 잡힌다(overflow-x 만 주면 어긋난다).
             */
            <div className="max-h-[58vh] overflow-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="sticky top-0 left-0 z-20 bg-[var(--color-background)] py-2 pr-3 text-left font-medium">수강생</th>
                    {detail.sessions.map(session => (
                      <th
                        key={session.id}
                        className="group sticky top-0 z-10 bg-[var(--color-background)] px-1 py-2 text-center font-medium"
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <span className="tabular-nums">{session.sequence}</span>
                          {canWrite && (
                            <button
                              onClick={() => {
                                const marked = detail.roster.filter(row => row.attendedSessionIds.includes(session.id)).length;
                                const warning = marked > 0 ? `\n이 회차 출석 ${marked}건도 함께 삭제됩니다.` : '';
                                if (
                                  window.confirm(`${session.sequence}회차를 삭제할까요?${warning}\n남은 회차 번호는 1부터 다시 매겨집니다.`)
                                ) {
                                  removeSessionMut.mutate(session.id);
                                }
                              }}
                              disabled={removeSessionMut.isPending}
                              className="rounded p-0.5 text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--color-destructive)] focus-visible:opacity-100"
                              aria-label={`${session.sequence}회차 삭제`}
                              title="회차 삭제"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                        {canWrite ? (
                          <input
                            type="date"
                            value={session.date ?? ''}
                            onChange={event => sessionMut.mutate({ sessionId: session.id, date: event.target.value })}
                            className="mt-1 w-[7.5rem] rounded border border-[var(--color-border)] px-1 py-0.5 text-[10px]"
                          />
                        ) : (
                          <div className="text-[10px] text-[var(--color-muted-foreground)]">{session.date ?? '-'}</div>
                        )}
                      </th>
                    ))}
                    <th className="sticky top-0 z-10 bg-[var(--color-background)] px-2 py-2 text-right font-medium">출석률</th>
                    <th className="sticky top-0 z-10 bg-[var(--color-background)] py-2 pl-2 text-right font-medium">상태</th>
                    {canWrite && <th className="sticky top-0 z-10 w-8 bg-[var(--color-background)] py-2" aria-label="수강 취소" />}
                  </tr>
                </thead>
                <tbody>
                  {detail.roster.map(row => (
                    <tr key={row.enrollmentId} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="sticky left-0 z-10 bg-[var(--color-background)] py-2 pr-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <Avatar name={row.memberName} size="xs" />
                          {row.memberName}
                        </span>
                      </td>
                      {detail.sessions.map(session => {
                        const present = row.attendedSessionIds.includes(session.id);
                        return (
                          <td key={session.id} className="px-1 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={present}
                              disabled={!canWrite || attendanceMut.isPending}
                              onChange={() =>
                                attendanceMut.mutate({
                                  sessionId: session.id,
                                  enrollmentId: row.enrollmentId,
                                  present: !present,
                                })
                              }
                              className="size-4 accent-[var(--color-foreground)]"
                            />
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-right tabular-nums">{row.attendanceRate}%</td>
                      <td className="py-2 pl-2 text-right">
                        {/* 수료 버튼 하나만 두면 되돌리거나 중도포기로 옮길 방법이 없었다.
                            세 상태를 모두 오갈 수 있게 드롭다운으로 바꿨다. */}
                        {canWrite ? (
                          <select
                            value={row.status}
                            disabled={enrollmentStatusMut.isPending}
                            onChange={event =>
                              enrollmentStatusMut.mutate({
                                enrollmentId: row.enrollmentId,
                                status: event.target.value as EnrollmentStatus,
                              })
                            }
                            className="rounded-md bg-[var(--color-background)] px-2 py-1 text-xs shadow-[var(--shadow-input)] outline-none focus-visible:shadow-[var(--shadow-input-focus)]"
                          >
                            {(['enrolled', 'completed', 'dropped'] as EnrollmentStatus[]).map(status => (
                              <option key={status} value={status}>
                                {ENROLLMENT_STATUS_LABEL[status]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge tone={row.status === 'completed' ? 'success' : 'muted'}>{ENROLLMENT_STATUS_LABEL[row.status]}</Badge>
                        )}
                      </td>
                      {canWrite && (
                        <td className="py-2 pl-1 text-right">
                          <button
                            onClick={() => {
                              if (window.confirm(`${row.memberName} 님을 이 기수에서 제외할까요?\n출석 기록도 함께 삭제됩니다.`)) {
                                removeEnrollmentMut.mutate(row.enrollmentId);
                              }
                            }}
                            disabled={removeEnrollmentMut.isPending}
                            className="rounded-full p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-destructive)]"
                            aria-label={`${row.memberName} 수강 취소`}
                            title="수강 취소"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-[var(--color-muted-foreground)]">
            출석률은 참고용입니다. 수료는 담당자가 직접 확정하고, 수료하면 다음 단계 올리기를 위에서 제안합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 기수 이름 인라인 수정 — 교인 이름 수정과 같은 방식(제목을 눌러 그 자리에서 고친다).
 * 과정명은 못 바꾸고 기수 이름만 바꾼다. 과정을 옮기는 건 성격이 달라 여기서 다루지 않는다.
 */
function EditableCohortName({ cohort, canWrite, onSaved }: { cohort: Cohort; canWrite: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cohort.name);
  const cancelRef = useRef(false);

  const saveMut = useMutation({
    mutationFn: (name: string) => updateCohort(cohort.id, { name }),
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
    onError: (error: Error) => {
      window.alert(`이름 변경 실패: ${error.message}`);
      setDraft(cohort.name);
      setEditing(false);
    },
  });

  // blur 한 곳에서만 커밋(Enter 는 blur 로 수렴). Escape 는 취소 — 모달이 닫히지 않게 전파도 막는다.
  const commit = () => {
    if (cancelRef.current) {
      cancelRef.current = false;
      setDraft(cohort.name);
      setEditing(false);
      return;
    }
    const name = draft.trim();
    if (!name || name === cohort.name) {
      setDraft(cohort.name);
      setEditing(false);
      return;
    }
    saveMut.mutate(name);
  };

  if (!canWrite) return <h2 className="truncate text-lg font-semibold">{cohort.label}</h2>;

  if (editing) {
    return (
      <div className="flex items-baseline gap-1.5">
        <span className="shrink-0 text-lg font-semibold text-[var(--color-muted-foreground)]">{cohort.courseName}</span>
        <input
          autoFocus
          value={draft}
          maxLength={40}
          onChange={event => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              event.stopPropagation();
              cancelRef.current = true;
              event.currentTarget.blur();
            }
          }}
          className="w-44 rounded-md bg-[var(--color-background)] px-2 py-0.5 text-lg font-semibold shadow-[var(--shadow-input)] outline-none focus-visible:shadow-[var(--shadow-input-focus)]"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(cohort.name);
        setEditing(true);
      }}
      className="group inline-flex max-w-full items-center gap-1.5"
      title="기수 이름 수정"
    >
      <h2 className="truncate text-lg font-semibold">{cohort.label}</h2>
      <Pencil className="size-3.5 shrink-0 text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function EnrollPanel({ cohortId, enrolledMemberIds, onDone }: { cohortId: number; enrolledMemberIds: number[]; onDone: () => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number[]>([]);

  const { data } = useQuery({
    queryKey: ['members', 'for-enroll', query],
    queryFn: () => listMembers({ q: query || undefined, pageSize: 20 }),
    // 글자를 칠 때마다 queryKey 가 바뀌어 data 가 잠깐 undefined 로 떨어진다.
    // 그대로 두면 목록이 비었다가 다시 차면서 한 번 더 깜빡인다.
    placeholderData: keepPreviousData,
  });

  const enrollMut = useMutation({
    mutationFn: () => enrollMembers(cohortId, selected),
    onSuccess: onDone,
  });

  // 이전 STEP 수료 · 이 과정 미수강 — 기수를 열 때 "누구를 부를지"를 사람이 기억하지 않아도 되게 (planning 00.7 E)
  const { data: nextStep } = useQuery({
    queryKey: ['training', 'cohort', cohortId, 'next-step'],
    queryFn: () => fetchNextStepCandidates(cohortId),
  });

  // 이미 이 기수에 등록된 교인은 후보에서 뺀다.
  // 서버는 중복을 조용히 건너뛰기만 해서(enroll 의 skipped), 그대로 두면 이미 등록된 사람을
  // 다시 고를 수 있고 "1명 등록"을 눌러도 명단이 그대로여서 아무 일도 안 일어난 것처럼 보인다.
  const enrolled = new Set(enrolledMemberIds);
  const found: Member[] = data?.items ?? [];
  const items = found.filter(member => !enrolled.has(member.id));
  const hiddenCount = found.length - items.length;

  const nextCandidates = (nextStep?.candidates ?? []).filter(candidate => !enrolled.has(candidate.memberId));
  const allNextPicked = nextCandidates.length > 0 && nextCandidates.every(candidate => selected.includes(candidate.memberId));
  const togglePick = (memberId: number) =>
    setSelected(selected.includes(memberId) ? selected.filter(id => id !== memberId) : [...selected, memberId]);

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        {nextStep?.previousStep && (
          <div className="space-y-2 rounded-md border border-dashed border-[var(--color-border)] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">
                STEP {nextStep.previousStep} 수료 · 아직 이 과정을 안 들은 사람{' '}
                <span className="font-normal text-[var(--color-muted-foreground)] tabular-nums">{nextCandidates.length}명</span>
              </p>
              {nextCandidates.length > 0 && (
                <button
                  onClick={() =>
                    setSelected(
                      allNextPicked
                        ? selected.filter(id => !nextCandidates.some(candidate => candidate.memberId === id))
                        : Array.from(new Set([...selected, ...nextCandidates.map(candidate => candidate.memberId)]))
                    )
                  }
                  className="text-xs text-[var(--color-muted-foreground)] underline-offset-2 hover:underline"
                >
                  {allNextPicked ? '모두 해제' : '모두 선택'}
                </button>
              )}
            </div>
            {nextCandidates.length === 0 ? (
              <p className="text-[11px] text-[var(--color-muted-foreground)]">이전 STEP 수료자는 모두 이 과정을 듣고 있거나 들었습니다.</p>
            ) : (
              <div className="flex max-h-[84px] flex-wrap gap-1.5 overflow-y-auto">
                {nextCandidates.map(candidate => {
                  const picked = selected.includes(candidate.memberId);
                  return (
                    <button
                      key={candidate.memberId}
                      onClick={() => togglePick(candidate.memberId)}
                      title={`${candidate.completedLabel} 수료${candidate.completedAt ? ` (${candidate.completedAt})` : ''}`}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        picked
                          ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
                          : 'border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-accent)]'
                      )}
                    >
                      {candidate.memberName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <Input placeholder="이름으로 검색" value={query} onChange={event => setQuery(event.target.value)} />
        {/*
         * 결과 칸은 높이를 고정한다. 이 패널은 수강생 표 위에 있어서, 검색 결과 수에 따라
         * 칸이 늘었다 줄면 아래 표 전체가 밀리고 문서 높이가 바뀐다. 스크롤을 내린 상태였다면
         * 브라우저가 스크롤 위치를 다시 맞추면서 검색창까지 위아래로 튄다.
         * 넘치는 건 안에서 스크롤시킨다 — 3줄(칩 28px × 3 + 간격 6px × 2) 기준.
         */}
        <div className="h-[112px] overflow-y-auto rounded-md bg-[var(--color-muted)] p-2">
          {items.length === 0 ? (
            <p className="py-2 text-center text-xs text-[var(--color-muted-foreground)]">
              {hiddenCount > 0
                ? '검색된 교인은 이미 모두 이 기수에 등록되어 있습니다.'
                : query
                  ? '검색 결과가 없습니다.'
                  : '등록할 교인을 검색하세요.'}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {items.map(member => {
                  const picked = selected.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      onClick={() => togglePick(member.id)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        picked
                          ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
                          : 'border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-accent)]'
                      )}
                    >
                      {member.name}
                    </button>
                  );
                })}
              </div>
              {/* 왜 검색한 사람이 안 보이는지 알려준다 — 조용히 빼면 그것대로 헷갈린다.
                  높이 고정 칸 안이라 이 줄이 생겨도 레이아웃은 안 밀린다. */}
              {hiddenCount > 0 && (
                <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
                  이미 등록된 {hiddenCount}명은 목록에서 제외했습니다.
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => enrollMut.mutate()} disabled={selected.length === 0 || enrollMut.isPending}>
            {selected.length}명 등록
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
