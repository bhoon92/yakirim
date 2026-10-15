import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, GraduationCap, Globe2, PlaneTakeoff, Sprout } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router';

import { fetchHomeDashboard, type HomeActivityItem, type HomeScheduleItem } from '@/api/dashboard';
import { fetchStalledMembers } from '@/api/members';
import { fetchMyFlock } from '@/api/shepherds';
import { fetchPendingPromotions } from '@/api/training';
import { MemberDetailModal } from './member-detail-modal';
import { useAuth } from '@/auth/auth-context';
import { useChurchBranding } from '@/branding/church-branding';
import { PageHeader } from '@/components/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmojiTile } from '@/components/ui/emoji-tile';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatToday(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_LABELS[date.getDay()]})`;
}

function formatTime(item: HomeScheduleItem): string {
  if (item.allDay) return '종일';
  const d = new Date(item.startAt);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

/** 활동 종류별 이모지 — flex 문서함처럼 목록에서 종류가 바로 읽히게. */
const ACTIVITY_EMOJI: Record<HomeActivityItem['kind'], string> = {
  training: '🎓',
  missionary: '🌏',
  member: '🙂',
  offering: '🧺',
  transaction: '🧾',
};

export function DashboardPage() {
  const branding = useChurchBranding();
  const { state } = useAuth();
  const today = formatToday(new Date());
  const firstName = state.status === 'authenticated' ? state.account.name : '';
  const [openMemberId, setOpenMemberId] = useState<number | null>(null);

  const { data } = useQuery({
    queryKey: ['home', 'dashboard'],
    queryFn: fetchHomeDashboard,
  });

  const placeholder = data === undefined;
  const pipeline = data?.pipeline ?? [];
  const training = data?.training ?? [];
  const schedule = data?.schedule ?? [];
  const activity = data?.activity ?? [];
  const pipelineTotal = pipeline.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={<span className="tracking-[0.12em] uppercase">{branding.name}</span>}
        title={firstName ? `${firstName} 님, 오늘도 좋은 하루예요` : '양성 현황'}
        description={`${today} · 훈련과 파송이 어디까지 왔는지 한눈에 봅니다.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/calendar">
                <CalendarDays />
                달력
              </Link>
            </Button>
            <Button asChild>
              <Link to="/app/training">훈련 관리</Link>
            </Button>
          </>
        }
      />

      {/* flex 홈 구조: 넓은 본문 + 좁은 우측 레일 */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* 간사로 연결된 계정이면 교회 전체 현황보다 "내 사람"이 먼저다 */}
          <MyFlockCard onOpenMember={setOpenMemberId} />

          <SectionCard title="양성 파이프라인" hint={`총 ${pipelineTotal}명`} actionLabel="보드로 보기" actionTo="/app/pipeline">
            {pipeline.length === 0 ? (
              <EmptyRow>등록된 교인이 없습니다.</EmptyRow>
            ) : (
              <ul className="space-y-2.5">
                {pipeline.map(stage => (
                  <li key={stage.statusId} className="flex items-center gap-3">
                    <div className="w-16 shrink-0 text-xs text-[var(--color-muted-foreground)]">{stage.name}</div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-muted)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: pipelineTotal === 0 ? '0%' : `${Math.round((stage.count / pipelineTotal) * 100)}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="h-full rounded-full bg-[var(--color-brand)]"
                      />
                    </div>
                    <div className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">{stage.count}</div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/*
           * 분포 바로 아래에 둔다 — 분포는 "지금 어디에 있나", 이건 "누가 안 움직이나"다.
           * 담당자가 이번 주에 실제로 할 일이 나오는 곳이라 파이프라인과 짝으로 붙인다.
           */}
          <StalledCard onOpenMember={setOpenMemberId} />

          {/* 정체의 짝 — 정체는 "안 움직이는 사람", 이건 "움직였는데(수료) 기록이 안 따라온 사람"이다 */}
          <PendingPromotionCard />

          <SectionCard title="오늘의 일정" hint={`${schedule.length}건`} actionLabel="달력 열기" actionTo="/app/calendar">
            {schedule.length === 0 ? (
              <EmptyRow>오늘 예정된 일정이 없습니다.</EmptyRow>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {schedule.map(item => (
                  <li key={`${item.id}-${item.startAt}`} className="flex items-center gap-3 py-2.5">
                    <EmojiTile seed={item.layer} kind="calendar" emoji={item.layerIcon ?? undefined} size="sm" />
                    <div className="w-12 shrink-0 text-xs font-medium tabular-nums text-[var(--color-muted-foreground)]">
                      {formatTime(item)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
                        <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.layer}
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-[var(--color-muted-foreground)]" />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="최근 활동" hint="실시간">
            {activity.length === 0 ? (
              <EmptyRow>최근 활동이 없습니다.</EmptyRow>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {activity.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 py-2.5">
                    <Avatar name={item.who} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        <span className="font-medium">{item.who}</span>
                        <span className="text-[var(--color-muted-foreground)]">{' · '}</span>
                        <span className="text-[var(--color-muted-foreground)]">{item.what}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{timeAgo(item.at)}</div>
                    </div>
                    <span aria-hidden className="shrink-0 text-base leading-6">
                      {ACTIVITY_EMOJI[item.kind]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* 우측 레일 — flex 처럼 지표를 세로로 쌓는다 */}
        <div className="space-y-3">
          <StatCard
            icon={Globe2}
            label="현재 파송"
            value={placeholder ? '—' : `${data.stats.activeMissionaries}명`}
            to="/app/missionaries"
            accent
          />
          <StatCard
            icon={PlaneTakeoff}
            label="올해 파송 확정"
            value={placeholder ? '—' : `${data.stats.commissionedThisYear}명`}
            to="/app/missionaries"
          />
          <StatCard
            icon={GraduationCap}
            label="진행 중 훈련"
            value={placeholder ? '—' : `${data.stats.ongoingCohorts}개 기수`}
            to="/app/training"
          />
          <StatCard icon={Sprout} label="올해 수료" value={placeholder ? '—' : `${data.stats.completedThisYear}명`} to="/app/training" />

          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">진행 중 훈련</h2>
                <Link to="/app/training" className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
                  전체
                </Link>
              </div>
              {training.length === 0 ? (
                <p className="py-2 text-xs text-[var(--color-muted-foreground)]">진행 중인 기수가 없습니다.</p>
              ) : (
                <ul className="space-y-2.5">
                  {training.map(cohort => (
                    <li key={cohort.cohortId} className="flex items-center gap-2.5">
                      <EmojiTile seed={cohort.label} kind="training" emoji={cohort.icon ?? undefined} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{cohort.label}</div>
                        <div className="text-[11px] tabular-nums text-[var(--color-muted-foreground)]">
                          수강 {cohort.enrolledCount}명 · {cohort.sessionCount}회차
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {openMemberId !== null && <MemberDetailModal memberId={openMemberId} onClose={() => setOpenMemberId(null)} />}
    </div>
  );
}

/**
 * 정체된 사람 — 현재 단계에 그 단계의 기준 일수 이상 머물러 있는 교인.
 * 기준은 재적상태별 설정값(방문 30일 / 새가족 90일 …)이라 화면이 숫자를 정하지 않는다.
 */
function StalledCard({ onOpenMember }: { onOpenMember: (id: number) => void }) {
  const { data: stalled, isLoading } = useQuery({
    queryKey: ['members', 'stalled'],
    queryFn: () => fetchStalledMembers(),
  });

  const rows = stalled ?? [];
  const shown = rows.slice(0, 5);

  return (
    <SectionCard
      title="정체된 사람"
      hint={isLoading ? undefined : `${rows.length}명`}
      actionLabel="전체 보기"
      actionTo="/app/members?stalled=true"
    >
      {isLoading ? (
        <EmptyRow>불러오는 중…</EmptyRow>
      ) : rows.length === 0 ? (
        <EmptyRow>단계별 기준 일수를 넘긴 사람이 없습니다.</EmptyRow>
      ) : (
        <>
          <ul className="divide-y divide-[var(--color-border)]">
            {shown.map(person => (
              <li key={person.memberId}>
                <button
                  onClick={() => onOpenMember(person.memberId)}
                  className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-[var(--color-muted)]"
                >
                  <Avatar name={person.memberName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{person.memberName}</div>
                    <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                      {person.statusName} · {person.since}부터
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">{person.days}일째</div>
                    <div className="text-[11px] tabular-nums text-[var(--color-muted-foreground)]">기준 {person.threshold}일</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {rows.length > shown.length && (
            <p className="pt-1 text-xs text-[var(--color-muted-foreground)]">외 {rows.length - shown.length}명</p>
          )}
        </>
      )}
    </SectionCard>
  );
}

/** 이 날수 넘게 기록이 없으면 연락할 때 — "내가 맡은 사람" 화면과 같은 기준. */
const QUIET_DAYS = 30;

/** 로그인한 간사의 "연락할 때가 된 사람" — 간사가 아니면(계정 연결 없음) 카드 자체가 없다. */
function MyFlockCard({ onOpenMember }: { onOpenMember: (id: number) => void }) {
  const { state } = useAuth();
  const isShepherd = state.status === 'authenticated' && Boolean(state.self?.residentId);
  const { data } = useQuery({ queryKey: ['flock', 'me'], queryFn: fetchMyFlock, enabled: isShepherd });
  if (!isShepherd || !data) return null;

  const due = data.flock.filter(row => !row.lastCareNoteDate || row.daysSinceContact >= QUIET_DAYS);
  const shown = due.slice(0, 4);

  return (
    <SectionCard
      title="연락할 때가 된 사람"
      hint={`맡은 ${data.flock.length}명 중 ${due.length}명`}
      actionLabel="내가 맡은 사람"
      actionTo="/app/my-flock"
    >
      {data.flock.length === 0 ? (
        <EmptyRow>아직 맡은 성도가 없습니다.</EmptyRow>
      ) : due.length === 0 ? (
        <EmptyRow>맡은 사람 모두 최근 {QUIET_DAYS}일 안에 만났습니다.</EmptyRow>
      ) : (
        <>
          <ul className="divide-y divide-[var(--color-border)]">
            {shown.map(row => (
              <li key={row.memberId}>
                <button
                  onClick={() => onOpenMember(row.memberId)}
                  className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-[var(--color-muted)]"
                >
                  <Avatar name={row.memberName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{row.memberName}</div>
                    <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{row.statusName}</div>
                  </div>
                  <div className="shrink-0 text-right text-sm font-semibold whitespace-nowrap text-[#8a5700] tabular-nums">
                    {row.lastCareNoteDate ? `${row.daysSinceContact}일 전` : '기록 없음'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {due.length > shown.length && (
            <p className="pt-1 text-xs text-[var(--color-muted-foreground)]">외 {due.length - shown.length}명</p>
          )}
        </>
      )}
    </SectionCard>
  );
}

function PendingPromotionCard() {
  const { data = [], isLoading } = useQuery({ queryKey: ['training', 'promotions', 'pending'], queryFn: fetchPendingPromotions });
  // 제안 설정을 안 한 교회에는 늘 비어 있으니 카드 자체를 숨긴다
  if (isLoading || data.length === 0) return null;
  const people = new Set(data.flatMap(row => [...row.candidates, ...row.residentCandidates].map(person => person.memberId)));

  return (
    <SectionCard title="수료 후 다음 단계" hint={`${people.size}명`} actionLabel="훈련으로" actionTo="/app/training">
      <ul className="divide-y divide-[var(--color-border)]">
        {data.slice(0, 5).map(row => (
          <li key={row.cohortId}>
            <Link
              to={`/app/training?cohort=${row.cohortId}`}
              className="flex items-center gap-3 py-2.5 transition-colors hover:bg-[var(--color-muted)]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{row.label}</div>
                <div className="mt-0.5 truncate text-xs text-[var(--color-muted-foreground)]">
                  {[
                    row.target && row.candidates.length > 0 ? `“${row.target.name}”(으)로 올릴 ${row.candidates.length}명` : null,
                    row.residentCandidates.length > 0 ? `간사 등록 제안 ${row.residentCandidates.length}명` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-[var(--color-muted-foreground)]" />
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  to,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  to: string;
  accent?: boolean;
}) {
  return (
    <Link to={to} className="block">
      <Card className="transition-colors hover:bg-[var(--color-background)] hover:shadow-[0_0_0_1px_rgb(0_0_0/0.1)]">
        <CardContent className="flex items-center gap-3 p-4">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: accent ? 'var(--color-brand-muted)' : 'var(--color-muted)',
              color: accent ? 'var(--color-brand-active)' : 'var(--color-muted-foreground)',
            }}
          >
            <Icon className="size-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
            {/* flex 는 지표 숫자를 크게 쓴다 — 라벨보다 값이 먼저 읽혀야 한다 */}
            <div className="text-2xl font-bold tracking-tighter tabular-nums">{value}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">{children}</p>;
}

function SectionCard({
  title,
  hint,
  actionLabel,
  actionTo,
  children,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  actionTo?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">{title}</h2>
            {hint && <span className="text-xs text-[var(--color-muted-foreground)]">{hint}</span>}
          </div>
          {actionLabel && actionTo && (
            <Link
              to={actionTo}
              className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            >
              {actionLabel}
              <ChevronRight className="size-3" />
            </Link>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
