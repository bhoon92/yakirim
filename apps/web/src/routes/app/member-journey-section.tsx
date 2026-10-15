import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { fetchStatusHistory } from '@/api/members';
import { addNote, createMissionary, fetchMissionaryByMember, listStages, updateMissionary } from '@/api/missionary';
import { ENROLLMENT_STATUS_LABEL, fetchMemberTrainingHistory, type EnrollmentStatus } from '@/api/training';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<EnrollmentStatus, 'neutral' | 'muted' | 'success' | 'warn'> = {
  enrolled: 'warn',
  completed: 'success',
  dropped: 'muted',
};

/**
 * 교인 한 명의 양성 경로 — 단계 이동, (있으면) 훈련 이력, (있으면) 파송 트랙.
 *
 * 예전에는 이 묶음을 교인 상세 맨 위에 통째로 뒀는데, 교인 대부분은 훈련도 파송도 없는
 * 평신도라서 카드를 열 때마다 "파송 트랙에 등록되지 않은 교인입니다" 가 먼저 보였다.
 * 해당되는 사람에게만 보이도록 바꾸고 위치도 기록·사역 아래로 내렸다.
 */
export function MemberJourneySection({ memberId }: { memberId: number }) {
  return (
    <div className="space-y-5">
      <StatusTimeline memberId={memberId} />
      <TrainingHistory memberId={memberId} />
      <MissionaryTrack memberId={memberId} />
    </div>
  );
}

/**
 * 단계 이동 이력 — 이 사람이 파이프라인을 어떻게 통과해 왔는지.
 * 현재 구간(endDate 없음)은 "N일째"로 보여준다. 담당자가 가장 먼저 보는 숫자다.
 */
function StatusTimeline({ memberId }: { memberId: number }) {
  const { data: periods = [], isLoading } = useQuery({
    queryKey: ['member', memberId, 'status-history'],
    queryFn: () => fetchStatusHistory(memberId),
  });

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">단계 이동</h3>
      {isLoading ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">불러오는 중…</p>
      ) : periods.length === 0 ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">이동 이력 없음</p>
      ) : (
        <ol className="space-y-1.5">
          {periods.map(period => {
            const current = period.endDate === null;
            return (
              <li key={period.id} className="flex items-center gap-2.5 text-xs">
                <span className={cn('size-1.5 shrink-0 rounded-full', current ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-border)]')} />
                <span className={cn('w-16 shrink-0', current ? 'font-semibold' : 'font-medium')}>{period.statusName ?? '—'}</span>
                <span className="tabular-nums text-[var(--color-muted-foreground)]">
                  {period.startDate} → {period.endDate ?? '현재'}
                </span>
                <span className="tabular-nums text-[var(--color-muted-foreground)]">
                  {current ? `${period.days}일째` : `${period.days}일`}
                </span>
                {period.reason && <span className="truncate text-[var(--color-muted-foreground)]">· {period.reason}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function TrainingHistory({ memberId }: { memberId: number }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['training-history', memberId],
    queryFn: () => fetchMemberTrainingHistory(memberId),
  });

  // 훈련을 한 번도 안 받은 교인이 대부분이다 — 빈 섹션을 띄우지 않는다.
  if (isLoading || history.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">훈련 이력</h3>
      <ul className="space-y-2">
        {history.map(item => (
          <li
            key={item.enrollmentId}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.label}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {item.enrolledAt}
                {item.closedAt ? ` → ${item.closedAt}` : ''} · 출석 {item.attendanceRate}%
              </p>
            </div>
            <Badge tone={STATUS_TONE[item.status]}>{ENROLLMENT_STATUS_LABEL[item.status]}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MissionaryTrack({ memberId }: { memberId: number }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('missionary:write');
  const [memo, setMemo] = useState('');
  const [stageId, setStageId] = useState<number | ''>('');

  const { data: missionary, isLoading } = useQuery({
    queryKey: ['missionary', 'by-member', memberId],
    queryFn: () => fetchMissionaryByMember(memberId),
  });
  const { data: stages = [] } = useQuery({ queryKey: ['missionary', 'stages'], queryFn: listStages });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['missionary', 'by-member', memberId] });
    queryClient.invalidateQueries({ queryKey: ['missionaries'] });
    queryClient.invalidateQueries({ queryKey: ['member', memberId] });
    queryClient.invalidateQueries({ queryKey: ['home', 'dashboard'] });
  };

  const registerMut = useMutation({
    mutationFn: () => createMissionary({ memberId }),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`트랙 등록 실패: ${error.message}`),
  });

  const stageMut = useMutation({
    mutationFn: (nextStageId: number) => updateMissionary(missionary!.id, { stageId: nextStageId }),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`단계 변경 실패: ${error.message}`),
  });

  const noteMut = useMutation({
    mutationFn: () => addNote(missionary!.id, { content: memo.trim(), stageId: stageId === '' ? undefined : stageId }),
    onSuccess: () => {
      setMemo('');
      setStageId('');
      invalidate();
    },
    onError: (error: Error) => window.alert(`기록 실패: ${error.message}`),
  });

  if (isLoading) return null;

  /*
   * 파송 트랙에 없는 교인이 대부분이다(평신도). 예전에는 모두에게 "등록되지 않은 교인입니다"
   * 라는 섹션을 띄워서, 그냥 섬기는 성도의 카드까지 파송 이야기로 시작했다.
   * 이제는 등록 버튼만 한 줄로 남기고, 트랙에 실제로 올라간 사람에게만 내용을 보여준다.
   */
  if (!missionary) {
    if (!canWrite) return null;
    return (
      <button
        type="button"
        onClick={() => registerMut.mutate()}
        disabled={registerMut.isPending}
        className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] disabled:opacity-50"
      >
        <Plus className="size-3" />
        파송 트랙에 등록
      </button>
    );
  }

  const activeStages = stages.filter(stage => stage.isActive || stage.id === missionary.stageId);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">파송 트랙</h3>
        <Badge tone={missionary.stageCountsAsActive ? 'success' : 'neutral'}>{missionary.stageName ?? '단계 미지정'}</Badge>
      </div>

      {(missionary.country || missionary.fieldWork) && (
        <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
          {[missionary.country, missionary.region].filter(Boolean).join(' ')}
          {missionary.fieldWork ? ` · ${missionary.fieldWork}` : ''}
        </p>
      )}

      {canWrite && (
        <div className="space-y-2">
          <select
            value={missionary.stageId ?? ''}
            onChange={event => event.target.value !== '' && stageMut.mutate(Number(event.target.value))}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-xs"
          >
            <option value="">단계 미지정</option>
            {activeStages.map(stage => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>

          <div className="flex gap-1.5">
            <input
              value={memo}
              onChange={event => setMemo(event.target.value)}
              placeholder="경과 메모"
              className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-xs outline-none focus:border-[var(--color-foreground)]"
            />
            <select
              value={stageId}
              onChange={event => setStageId(event.target.value === '' ? '' : Number(event.target.value))}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs"
            >
              <option value="">단계 변화 없음</option>
              {activeStages.map(stage => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={() => noteMut.mutate()} disabled={!memo.trim() || noteMut.isPending}>
              기록
            </Button>
          </div>

          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            파송 집계 단계로 옮기면 재적상태가 “파송”이 되어 출석 명단에서 빠집니다. 기록 목록은 선교사 화면에서 볼 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
