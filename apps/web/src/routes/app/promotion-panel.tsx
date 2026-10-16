import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';

import { applyCohortPromotions, dismissCohortPromotions, fetchCohortPromotions } from '@/api/training';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';

/**
 * 수료 → 다음 단계 제안 (planning 00.7 C).
 *
 * 수료로 바꾸는 순간 기수 화면 위쪽에 뜬다. 제안은 매번 데이터에서 계산되므로 올리고 나면 저절로 사라지고,
 * 안 올리고 닫아도 다음에 열면 다시 보인다. 올리지 않을 사람은 "넘기기"로 감춘다(수강 기록에 넘긴 날이 남는다).
 * **자동으로 바꾸지 않는다** — 담당자가 보고 누른다.
 */
export function PromotionPanel({ cohortId }: { cohortId: number }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  // 패널이 기수 상세 쿼리 키 아래에 있어서, 수료 처리(invalidate)와 함께 다시 계산된다
  const { data } = useQuery({
    queryKey: ['training', 'cohort', cohortId, 'promotions'],
    queryFn: () => fetchCohortPromotions(cohortId),
  });
  // 체크를 해제한 사람만 기억한다 — 새 수료자는 기본으로 체크된 채 들어온다
  const [unchecked, setUnchecked] = useState<Set<number>>(new Set());

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['training', 'cohort', cohortId] });
    queryClient.invalidateQueries({ queryKey: ['members'] });
    queryClient.invalidateQueries({ queryKey: ['member'] });
    queryClient.invalidateQueries({ queryKey: ['home', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['training', 'promotions'] });
  };

  const promoteMut = useMutation({
    mutationFn: (memberIds: number[]) => applyCohortPromotions(cohortId, memberIds),
    onSuccess: result => {
      setUnchecked(new Set());
      invalidate();
      if (result.skipped > 0)
        window.alert(`${result.promoted}명을 올렸습니다. ${result.skipped}명은 이미 그 단계 이상이라 건너뛰었습니다.`);
    },
    onError: (error: Error) => window.alert(`단계 올리기 실패: ${error.message}`),
  });

  const dismissMut = useMutation({
    mutationFn: (memberIds: number[]) => dismissCohortPromotions(cohortId, memberIds),
    onSuccess: () => {
      setUnchecked(new Set());
      invalidate();
    },
    onError: (error: Error) => window.alert(`넘기기 실패: ${error.message}`),
  });

  // 넘기기는 그 사람의 이 기수 제안을 감춘다 — 수강 기록 하나에 표시가 하나라서
  const dismiss = (memberIds: number[], names: string) => {
    if (window.confirm(`${names} — 이 기수의 수료 제안(단계 올리기)에서 뺄까요?\n수료를 취소했다가 다시 수료하면 다시 나타납니다.`)) {
      dismissMut.mutate(memberIds);
    }
  };

  if (!data) return null;
  const showPromote = can('member:write') && data.target && data.candidates.length > 0;
  if (!showPromote) return null;

  const selected = data.candidates.filter(candidate => !unchecked.has(candidate.memberId)).map(candidate => candidate.memberId);
  const toggle = (memberId: number) =>
    setUnchecked(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });

  return (
    <div className="space-y-3 rounded-xl border border-[#b9e5c0] bg-[#f3fbf4] p-4">
      {showPromote && data.target && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <ArrowUpRight className="size-4 text-[#058012]" />
            수료자 {data.candidates.length}명이 아직 “{data.target.name}” 아래 단계입니다
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.candidates.map(candidate => {
              const on = !unchecked.has(candidate.memberId);
              return (
                <button
                  key={candidate.memberId}
                  onClick={() => toggle(candidate.memberId)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    on
                      ? 'border-[var(--color-foreground)] bg-[var(--color-background)] font-semibold'
                      : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] line-through'
                  )}
                  title={on ? '눌러서 제외' : '눌러서 포함'}
                >
                  {candidate.memberName}
                  <span className="ml-1 font-normal text-[var(--color-muted-foreground)]">{candidate.statusName}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => promoteMut.mutate(selected)} disabled={selected.length === 0 || promoteMut.isPending}>
              {selected.length}명을 “{data.target.name}”(으)로 올리기
            </Button>
            {selected.length < data.candidates.length ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={dismissMut.isPending}
                onClick={() => {
                  const skipped = data.candidates.filter(candidate => unchecked.has(candidate.memberId));
                  dismiss(
                    skipped.map(candidate => candidate.memberId),
                    skipped.map(candidate => candidate.memberName).join(', ')
                  );
                }}
              >
                제외한 {data.candidates.length - selected.length}명 넘기기
              </Button>
            ) : (
              <span className="text-[11px] text-[var(--color-muted-foreground)]">
                단계 이력에 수료일과 “기수 수료” 사유가 남습니다. 올리지 않을 사람은 눌러서 제외한 뒤 넘기세요.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
