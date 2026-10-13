import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Home, Search, Settings2, SquareArrowOutUpRight, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { listMembers, type Member } from '@/api/members';
import {
  createResident,
  deleteResidentHistory,
  fetchResidentDetail,
  fetchResidentSummary,
  listResidentStatuses,
  listResidents,
  removeResident,
  updateResident,
  type Resident,
  type ResidentStatus,
} from '@/api/residents';
import { ENROLLMENT_STATUS_LABEL, byLadder, listCourses, type EnrollmentStatus, type TrainingCourse } from '@/api/training';
import { PageHeader } from '@/components/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PanelToggle } from '@/components/ui/panel-toggle';
import { TagChip } from '@/components/ui/tag-chip';
import { todayString } from '@/lib/date';
import { useOrgLabels } from '@/lib/org-labels';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { CareNoteSection } from './care-note-section';
import { MemberDetailModal } from './member-detail-modal';
import { ResidentDutyPicker } from './resident-duty-picker';
import { ResidentStatusManagerModal } from './resident-status-manager';

/**
 * 공동체 간사 — 공동생활을 하며 내부에서 섬기는 선교사.
 *
 * 이 교회 구성원의 중심이라 메뉴 맨 위에 둔다. 해외 파송(선교사 화면)과는 관리 주체도
 * 보는 항목도 달라 화면을 나눴다. 하우스·사역팀·역할은 교인 카드의 소속·사역 역할을 그대로 읽는다.
 */
export function ResidentsPage() {
  const { can } = usePermissions();
  const canWrite = can('resident:write');
  const [filter, setFilter] = useState<{ kind: 'active' | 'all' | 'status'; statusId?: number }>({ kind: 'active' });
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);
  const [managingStatuses, setManagingStatuses] = useState(false);

  const { data: statuses = [] } = useQuery({ queryKey: ['resident', 'statuses'], queryFn: listResidentStatuses });
  const { data: summary } = useQuery({ queryKey: ['residents', 'summary'], queryFn: fetchResidentSummary });
  const { data: courses = [] } = useQuery({ queryKey: ['training', 'courses'], queryFn: listCourses });
  const { data: residents = [], isLoading } = useQuery({
    queryKey: ['residents', filter],
    queryFn: () =>
      listResidents(filter.kind === 'status' ? { statusId: filter.statusId } : { scope: filter.kind === 'active' ? 'active' : 'all' }),
  });

  // 50명 규모라 서버 검색까지 갈 필요 없이 받아온 목록에서 거른다.
  const visible = useMemo(() => {
    const keyword = search.trim();
    if (!keyword) return residents;
    return residents.filter(
      resident =>
        resident.memberName.includes(keyword) ||
        resident.smallGroups.some(tag => tag.name?.includes(keyword)) ||
        resident.ministries.some(tag => tag.name?.includes(keyword)) ||
        resident.duties.some(duty => duty.name.includes(keyword))
    );
  }, [residents, search]);

  // STEP 번호가 있는 과정만 사다리다. 숨긴 과정도 수료 이력은 남아 있으니 함께 보여준다.
  const steps = useMemo(() => courses.filter(course => course.step !== null).sort(byLadder), [courses]);
  const countFor = (statusId: number) => summary?.byStatus.find(row => row.statusId === statusId)?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="공동체"
        title="간사"
        description="공동생활을 하며 섬기는 간사(선교사)를 관리합니다. 하우스·사역팀·역할은 교인 카드의 소속을 그대로 보여줍니다."
        actions={
          canWrite && (
            <>
              <Button size="sm" variant="outline" onClick={() => setManagingStatuses(true)}>
                <Settings2 className="size-4" />
                상태 관리
              </Button>
              <PanelToggle open={registering} onToggle={() => setRegistering(!registering)} label="간사 등록" variant="default" />
            </>
          )
        }
      />

      {managingStatuses && <ResidentStatusManagerModal onClose={() => setManagingStatuses(false)} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="공동체 인원" value={summary ? `${summary.active}명` : '—'} />
        {(summary?.byStatus ?? []).slice(0, 3).map(row => (
          <StatTile key={row.statusId ?? 'none'} label={row.name} value={`${row.count}명`} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip active={filter.kind === 'active'} onClick={() => setFilter({ kind: 'active' })}>
          공동체
        </FilterChip>
        <FilterChip active={filter.kind === 'all'} onClick={() => setFilter({ kind: 'all' })}>
          전체
        </FilterChip>
        {statuses
          .filter(status => status.isActive)
          .map(status => (
            <FilterChip
              key={status.id}
              active={filter.kind === 'status' && filter.statusId === status.id}
              onClick={() => setFilter({ kind: 'status', statusId: status.id })}
            >
              {status.name} {countFor(status.id)}
            </FilterChip>
          ))}
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <Input placeholder="이름·하우스·사역" value={search} onChange={event => setSearch(event.target.value)} className="pl-8" />
        </div>
      </div>

      {registering && <RegisterPanel statuses={statuses} onClose={() => setRegistering(false)} />}

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</p>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Home className="size-8 text-[var(--color-muted-foreground)]" />
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {search
                ? '검색 결과가 없습니다.'
                : filter.kind === 'active'
                  ? '공동체에 등록된 간사가 없습니다.'
                  : '해당 조건의 간사가 없습니다.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--color-border)]">
            {visible.map(resident => (
              <li key={resident.id}>
                {/* 행 안에 맡은 사역 칸(버튼들)이 있어 행 자체를 <button> 으로 둘 수 없다 */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(resident.id)}
                  onKeyDown={event => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      setOpenId(resident.id);
                    }
                  }}
                  className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-muted)]"
                >
                  <Avatar name={resident.memberName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{resident.memberName}</span>
                      <StatusBadge resident={resident} />
                      <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">{tenureLabel(resident)}</span>
                    </div>
                    <ResidentTags resident={resident} />
                    <div className="mt-1.5">
                      <ResidentDutyPicker residentId={resident.id} duties={resident.duties} canWrite={canWrite} size="sm" />
                    </div>
                  </div>
                  <TrainingSteps steps={steps} training={resident.training} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {openId !== null && <ResidentDetailModal id={openId} statuses={statuses} steps={steps} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/** "입주 3년차" — 간사를 볼 때 가장 먼저 묻는 숫자. 입주일이 없으면 헌신일로 대신한다. */
function tenureLabel(resident: Resident): string {
  const since = resident.joinedAt ?? resident.committedAt;
  if (!since) return '입주일 미입력';
  const end = resident.leftAt ?? todayString();
  const days = Math.floor((Date.parse(end) - Date.parse(since)) / 86_400_000);
  const years = Math.max(0, Math.floor(days / 365)) + 1;
  return resident.leftAt ? `${since} ~ ${resident.leftAt}` : `${resident.joinedAt ? '입주' : '헌신'} ${years}년차`;
}

function StatusBadge({ resident }: { resident: Resident }) {
  if (!resident.statusName) return <Badge tone="muted">상태 미지정</Badge>;
  return <Badge tone={resident.statusCountsAsActive ? 'success' : 'muted'}>{resident.statusName}</Badge>;
}

/** 역할 → 하우스 → 사역팀 순. 교인 목록의 태그와 같은 색 기준(기준정보 id)이다. */
function ResidentTags({ resident }: { resident: Resident }) {
  const orgLabels = useOrgLabels();
  const tags: { key: string; name: string; seed: number; kind: string; leader?: boolean }[] = [];
  if (resident.position?.name) {
    tags.push({ key: `p${resident.position.id}`, name: resident.position.name, seed: resident.position.id, kind: '사역 역할' });
  }
  for (const tag of resident.smallGroups) {
    if (tag.name) tags.push({ key: `s${tag.id}`, name: tag.name, seed: tag.id, kind: orgLabels.smallGroup, leader: tag.isLeader });
  }
  for (const tag of resident.ministries) {
    if (tag.name) tags.push({ key: `m${tag.id}`, name: tag.name, seed: tag.id, kind: orgLabels.ministry, leader: tag.isLeader });
  }
  if (tags.length === 0) return <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">소속·역할 없음</p>;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {tags.map(tag => (
        <TagChip
          key={tag.key}
          name={tag.name}
          seed={tag.seed}
          title={tag.leader ? `${tag.kind} · 리더` : tag.kind}
          className={cn('px-2 py-0.5', tag.leader && 'ring-1 ring-[var(--color-foreground)] ring-inset')}
          prefix={tag.leader ? <span className="text-[10px] leading-none">★</span> : undefined}
        />
      ))}
    </div>
  );
}

const STEP_STYLE: Record<EnrollmentStatus | 'none', string> = {
  completed: 'bg-[#e4f7e7] text-[#058012]',
  enrolled: 'bg-[#f7ecd6] text-[#8a5700]',
  dropped: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] line-through',
  none: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] opacity-60',
};

/**
 * 훈련 사다리 — 과정에 붙은 STEP 번호(course.step)로 그린다. 수료는 초록, 수강 중은 노랑.
 * 목록 오른쪽에 숫자 칸으로 붙여서, 누가 어디까지 왔는지 세로로 훑어볼 수 있게 한다.
 */
function TrainingSteps({ steps, training }: { steps: TrainingCourse[]; training: Resident['training'] }) {
  if (steps.length === 0) return null;
  const byCourse = new Map(training.map(row => [row.courseId, row.status]));
  return (
    <div className="hidden shrink-0 items-center gap-1 sm:flex">
      {steps.map(course => {
        const status = byCourse.get(course.id);
        return (
          <span
            key={course.id}
            title={`${course.name} · ${status ? ENROLLMENT_STATUS_LABEL[status] : '미수강'}`}
            className={cn(
              'flex size-6 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums',
              STEP_STYLE[status ?? 'none']
            )}
          >
            {course.step}
          </span>
        );
      })}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
          : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
      )}
    >
      {children}
    </button>
  );
}

/** 등록 패널 — 선교사 등록과 같은 흐름. 명부에 없는 사람도 바로 등록한다. */
function RegisterPanel({ statuses, onClose }: { statuses: ResidentStatus[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Member | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // null = 아직 고르지 않음 → 첫 '공동체 집계' 상태를 기본값으로 쓴다 (상태 목록이 늦게 와도 맞게)
  const [statusChoice, setStatusChoice] = useState<number | '' | null>(null);
  const statusId = statusChoice ?? statuses.find(status => status.isActive && status.countsAsActive)?.id ?? '';
  const [joinedAt, setJoinedAt] = useState('');
  const [committedAt, setCommittedAt] = useState('');

  const { data } = useQuery({
    queryKey: ['members', 'for-resident', query],
    queryFn: () => listMembers({ q: query || undefined, pageSize: 20 }),
    enabled: mode === 'existing',
    placeholderData: keepPreviousData,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createResident({
        ...(mode === 'existing' ? { memberId: picked!.id } : { newMember: { name: name.trim(), phone: phone.trim() || undefined } }),
        statusId: statusId === '' ? undefined : statusId,
        joinedAt: joinedAt || undefined,
        committedAt: committedAt || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residents'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      onClose();
    },
    onError: (error: Error) => window.alert(`등록 실패: ${error.message}`),
  });

  const ready = mode === 'existing' ? Boolean(picked) : Boolean(name.trim());

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex gap-1.5">
          <FilterChip active={mode === 'existing'} onClick={() => setMode('existing')}>
            기존 교인에서 선택
          </FilterChip>
          <FilterChip active={mode === 'new'} onClick={() => setMode('new')}>
            새로 등록
          </FilterChip>
        </div>

        {mode === 'new' ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="이름" value={name} onChange={event => setName(event.target.value)} className="w-40" />
              <Input placeholder="연락처 (선택)" value={phone} onChange={event => setPhone(event.target.value)} className="w-44" />
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)]">교인 명부에도 함께 등록됩니다.</p>
          </>
        ) : (
          <>
            <Input placeholder="교인 이름으로 검색" value={query} onChange={event => setQuery(event.target.value)} />
            {/* 선교사 등록과 같은 이유로 높이를 고정한다 — 결과 수에 따라 검색창이 흔들리지 않게. */}
            <div className="h-[112px] overflow-y-auto rounded-md bg-[var(--color-muted)] p-2">
              {(data?.items ?? []).length === 0 ? (
                <p className="py-2 text-center text-xs text-[var(--color-muted-foreground)]">
                  {query ? '검색 결과가 없습니다.' : '등록할 교인을 검색하세요.'}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(data?.items ?? []).map(member => (
                    <FilterChip key={member.id} active={picked?.id === member.id} onClick={() => setPicked(member)}>
                      {member.name}
                    </FilterChip>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs text-[var(--color-muted-foreground)]">
            <span>상태</span>
            <select
              value={statusId}
              onChange={event => setStatusChoice(event.target.value === '' ? '' : Number(event.target.value))}
              className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5 text-sm text-[var(--color-foreground)]"
            >
              <option value="">상태 미지정</option>
              {statuses
                .filter(status => status.isActive)
                .map(status => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-[var(--color-muted-foreground)]">
            <span>입주일</span>
            <Input type="date" value={joinedAt} onChange={event => setJoinedAt(event.target.value)} className="w-40" />
          </label>
          <label className="space-y-1 text-xs text-[var(--color-muted-foreground)]">
            <span>헌신 시작일</span>
            <Input type="date" value={committedAt} onChange={event => setCommittedAt(event.target.value)} className="w-40" />
          </label>
        </div>
        <p className="text-xs text-[var(--color-muted-foreground)]">하우스·사역팀·역할은 등록 후 교인 카드에서 정합니다.</p>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button size="sm" onClick={() => createMut.mutate()} disabled={!ready || createMut.isPending}>
            등록
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResidentDetailModal({
  id,
  statuses,
  steps,
  onClose,
}: {
  id: number;
  statuses: ResidentStatus[];
  steps: TrainingCourse[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('resident:write');
  const [memberCardOpen, setMemberCardOpen] = useState(false);

  const { data: resident, isLoading } = useQuery({ queryKey: ['resident', id], queryFn: () => fetchResidentDetail(id) });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 교인 카드가 위에 떠 있으면 그쪽이 먼저 닫힌다
      if (event.key === 'Escape' && !memberCardOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, memberCardOpen]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['resident', id] });
    queryClient.invalidateQueries({ queryKey: ['residents'] });
  };

  const removeMut = useMutation({
    mutationFn: () => removeResident(id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (error: Error) => window.alert(`제거 실패: ${error.message}`),
  });

  const deleteHistoryMut = useMutation({
    mutationFn: (historyId: number) => deleteResidentHistory(id, historyId),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`삭제 실패: ${error.message}`),
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
        <div
          className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-[var(--color-background)] shadow-md"
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-[var(--color-border)] px-6 py-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{resident?.memberName ?? '불러오는 중…'}</h2>
                {resident && <StatusBadge resident={resident} />}
              </div>
              {resident && (
                <p className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
                  {[resident.phone, tenureLabel(resident)].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {resident && (
                <Button size="sm" variant="ghost" onClick={() => setMemberCardOpen(true)}>
                  <SquareArrowOutUpRight className="size-3.5" />
                  교인 카드
                </Button>
              )}
              {canWrite && resident && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="간사에서 제거"
                  title="간사에서 제거"
                  disabled={removeMut.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `${resident.memberName} 님을 간사 목록에서 제거할까요?\n상태 이력도 함께 삭제됩니다. 교인 명부와 양육기록은 그대로 남습니다.\n(공동체를 떠난 경우에는 제거 대신 상태를 "퇴소"로 바꾸세요.)`
                      )
                    ) {
                      removeMut.mutate();
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

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {isLoading || !resident ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</p>
            ) : (
              <>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">맡은 사역</h3>
                  <ResidentDutyPicker residentId={resident.id} duties={resident.duties} canWrite={canWrite} />
                  {!canWrite && resident.duties.length === 0 && <p className="text-xs text-[var(--color-muted-foreground)]">없음</p>}
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">하우스 · 사역팀 · 역할</h3>
                  <ResidentTags resident={resident} />
                  <p className="text-[11px] text-[var(--color-muted-foreground)]">
                    배정·변경은{' '}
                    <button className="underline underline-offset-2" onClick={() => setMemberCardOpen(true)}>
                      교인 카드
                    </button>
                    에서 합니다. 소속 이력이 교인 쪽에 쌓여 조직도·출석과 함께 맞춰집니다.
                  </p>
                </section>

                <StatusEditor
                  key={resident.statusId ?? 'none'}
                  resident={resident}
                  statuses={statuses}
                  canWrite={canWrite}
                  onDone={invalidate}
                />

                <DatesEditor
                  key={[resident.joinedAt, resident.committedAt, resident.leftAt, resident.note].join('|')}
                  resident={resident}
                  canWrite={canWrite}
                  onDone={invalidate}
                />

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">훈련 단계</h3>
                  {steps.length === 0 ? (
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      STEP 번호가 붙은 과정이 없습니다. 훈련 화면의 과정 설정에서 정하세요.
                    </p>
                  ) : (
                    <ol className="space-y-1">
                      {steps.map(course => {
                        const status = resident.training.find(row => row.courseId === course.id)?.status;
                        return (
                          <li key={course.id} className="flex items-center gap-2 text-sm">
                            <span
                              className={cn(
                                'flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums',
                                STEP_STYLE[status ?? 'none']
                              )}
                            >
                              {course.step}
                            </span>
                            <span className={cn(!status && 'text-[var(--color-muted-foreground)]')}>{course.name}</span>
                            <span className="ml-auto text-xs text-[var(--color-muted-foreground)]">
                              {status ? ENROLLMENT_STATUS_LABEL[status] : '미수강'}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>

                <section className="space-y-2 border-t border-[var(--color-border)] pt-5">
                  <h3 className="text-sm font-semibold">상태 이력</h3>
                  {resident.history.length === 0 ? (
                    <p className="text-xs text-[var(--color-muted-foreground)]">이력 없음</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {resident.history.map(row => (
                        <li key={row.id} className="flex items-start gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2">
                          <span className="w-20 shrink-0 text-xs tabular-nums text-[var(--color-muted-foreground)]">{row.date}</span>
                          <div className="min-w-0 flex-1">
                            <Badge tone="neutral">{row.statusName ?? '(삭제된 상태)'}</Badge>
                            {row.reason && <p className="mt-1 text-sm whitespace-pre-wrap">{row.reason}</p>}
                            {row.recorderName && (
                              <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{row.recorderName}</p>
                            )}
                          </div>
                          {canWrite && (
                            <button
                              onClick={() => {
                                if (window.confirm('이 이력을 삭제할까요?\n현재 상태는 바뀌지 않습니다.')) deleteHistoryMut.mutate(row.id);
                              }}
                              className="rounded-full p-0.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
                              aria-label="이력 삭제"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* 케어·재훈련은 양육기록에 종류로 남긴다 — 교인 카드에서 보는 기록과 같은 것이다. */}
                <div className="border-t border-[var(--color-border)] pt-5">
                  <CareNoteSection memberId={resident.memberId} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {memberCardOpen && resident && (
        <MemberDetailModal
          memberId={resident.memberId}
          onClose={() => {
            setMemberCardOpen(false);
            // 교인 카드에서 바꾼 소속·역할이 간사 목록 태그에 바로 보이게
            invalidate();
          }}
        />
      )}
    </>
  );
}

/** 상태 변경 — 사유와 날짜를 함께 남긴다. 바꾸면 이력이 한 줄 쌓인다. */
function StatusEditor({
  resident,
  statuses,
  canWrite,
  onDone,
}: {
  resident: Resident;
  statuses: ResidentStatus[];
  canWrite: boolean;
  onDone: () => void;
}) {
  const [statusId, setStatusId] = useState<number | ''>(resident.statusId ?? '');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(todayString());

  const mut = useMutation({
    mutationFn: () =>
      updateResident(resident.id, { statusId: statusId as number, statusReason: reason.trim() || undefined, statusDate: date }),
    onSuccess: () => {
      setReason('');
      onDone();
    },
    onError: (error: Error) => window.alert(`상태 변경 실패: ${error.message}`),
  });

  if (!canWrite) return null;
  const changed = statusId !== '' && statusId !== resident.statusId;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">상태 변경</h3>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusId}
          onChange={event => setStatusId(event.target.value === '' ? '' : Number(event.target.value))}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5 text-sm"
        >
          {resident.statusId === null && <option value="">상태 미지정</option>}
          {statuses
            .filter(status => status.isActive || status.id === resident.statusId)
            .map(status => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
        </select>
        {changed && <Input type="date" value={date} onChange={event => setDate(event.target.value)} className="w-40" />}
      </div>
      {changed && (
        <>
          <Input
            placeholder="사유 (선택 — 예: 안식 6개월, 해외 파송으로 퇴소)"
            value={reason}
            onChange={event => setReason(event.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
              상태 변경
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function DatesEditor({ resident, canWrite, onDone }: { resident: Resident; canWrite: boolean; onDone: () => void }) {
  const [joinedAt, setJoinedAt] = useState(resident.joinedAt ?? '');
  const [committedAt, setCommittedAt] = useState(resident.committedAt ?? '');
  const [leftAt, setLeftAt] = useState(resident.leftAt ?? '');
  const [note, setNote] = useState(resident.note ?? '');

  const mut = useMutation({
    mutationFn: () =>
      updateResident(resident.id, {
        // 빈 칸은 보내지 않는다 — 날짜 검증(YYYY-MM-DD)에 걸린다. 지우는 건 아직 지원하지 않는다.
        joinedAt: joinedAt || undefined,
        committedAt: committedAt || undefined,
        leftAt: leftAt || undefined,
        note,
      }),
    onSuccess: onDone,
    onError: (error: Error) => window.alert(`저장 실패: ${error.message}`),
  });

  const dirty =
    joinedAt !== (resident.joinedAt ?? '') ||
    committedAt !== (resident.committedAt ?? '') ||
    leftAt !== (resident.leftAt ?? '') ||
    note !== (resident.note ?? '');

  if (!canWrite) {
    return (
      <section className="grid grid-cols-3 gap-2 text-sm">
        <DateCell label="입주일" value={resident.joinedAt} />
        <DateCell label="헌신 시작일" value={resident.committedAt} />
        <DateCell label="퇴소일" value={resident.leftAt} />
        {resident.note && <p className="col-span-3 text-[var(--color-muted-foreground)]">{resident.note}</p>}
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">입주 · 헌신</h3>
      <div className="flex flex-wrap gap-2">
        <label className="space-y-1 text-xs text-[var(--color-muted-foreground)]">
          <span>입주일</span>
          <Input type="date" value={joinedAt} onChange={event => setJoinedAt(event.target.value)} className="w-40" />
        </label>
        <label className="space-y-1 text-xs text-[var(--color-muted-foreground)]">
          <span>헌신 시작일</span>
          <Input type="date" value={committedAt} onChange={event => setCommittedAt(event.target.value)} className="w-40" />
        </label>
        <label className="space-y-1 text-xs text-[var(--color-muted-foreground)]">
          <span>퇴소일</span>
          <Input type="date" value={leftAt} onChange={event => setLeftAt(event.target.value)} className="w-40" />
        </label>
      </div>
      <Input placeholder="비고" value={note} onChange={event => setNote(event.target.value)} />
      {dirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
            저장
          </Button>
        </div>
      )}
    </section>
  );
}

function DateCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className="tabular-nums">{value ?? '—'}</p>
    </div>
  );
}
