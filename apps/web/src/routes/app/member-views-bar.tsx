import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { createMemberView, deleteMemberView, listMemberViews, type MemberView, type MemberViewFilters } from '@/api/members';
import { Input } from '@/components/ui/input';
import { isSubmitEnter } from '@/lib/keyboard';
import { cn } from '@/lib/utils';

const KEY = ['member-views'] as const;

/** 필터 비교용 — 빈 값을 빼고 키 순서를 맞춘다. */
function normalize(filters: MemberViewFilters): string {
  const entries = Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== false);
  return JSON.stringify(Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))));
}

/**
 * 노션 데이터베이스의 보기 탭처럼 — 교인 명부의 필터 묶음에 이름을 붙여 두고 탭으로 바로 연다.
 * 교회 전체가 함께 쓴다. 지금 필터와 똑같은 보기가 있으면 그 탭이 켜진다.
 */
export function MemberViewsBar({
  current,
  onApply,
  canWrite,
}: {
  current: MemberViewFilters;
  onApply: (filters: MemberViewFilters) => void;
  canWrite: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: views = [] } = useQuery({ queryKey: KEY, queryFn: listMemberViews });
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const currentKey = normalize(current);
  const hasFilter = currentKey !== '{}';
  const activeView = views.find(view => normalize(view.filters) === currentKey);

  const createMut = useMutation({
    mutationFn: () => createMemberView({ name: name.trim(), filters: current }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      setNaming(false);
      setName('');
    },
    onError: error => window.alert(error instanceof Error ? error.message : '보기를 저장하지 못했습니다.'),
  });
  const deleteMut = useMutation({
    mutationFn: (view: MemberView) => deleteMemberView(view.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });

  const tab = (active: boolean) =>
    cn(
      'inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-sm whitespace-nowrap transition-colors',
      active
        ? 'bg-[var(--color-muted)] font-semibold text-[var(--color-foreground)]'
        : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'
    );

  return (
    <div className="-mx-1 flex items-center gap-1 overflow-x-auto border-b border-[var(--color-border)] px-1 pb-2" aria-label="저장된 보기">
      <button type="button" className={tab(!hasFilter)} onClick={() => onApply({})}>
        전체
      </button>
      {views.map(view => {
        const active = view.id === activeView?.id;
        return (
          <span key={view.id} className={tab(active)}>
            <button type="button" onClick={() => onApply(view.filters)}>
              {view.name}
            </button>
            {active && canWrite && (
              <button
                type="button"
                aria-label={`"${view.name}" 보기 삭제`}
                title="보기 삭제"
                onClick={() => window.confirm(`"${view.name}" 보기를 지울까요? 교인 정보는 그대로입니다.`) && deleteMut.mutate(view)}
                className="rounded p-0.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              >
                <X className="size-3.5" />
              </button>
            )}
          </span>
        );
      })}
      {canWrite &&
        hasFilter &&
        !activeView &&
        (naming ? (
          <form
            className="flex items-center"
            onSubmit={event => {
              event.preventDefault();
              if (name.trim()) createMut.mutate();
            }}
          >
            <Input
              autoFocus
              value={name}
              maxLength={40}
              placeholder="보기 이름 (Enter)"
              onChange={event => setName(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Escape') setNaming(false);
                if (isSubmitEnter(event) && name.trim()) {
                  event.preventDefault();
                  createMut.mutate();
                }
              }}
              onBlur={() => !name.trim() && setNaming(false)}
              className="h-8 w-44 text-sm"
            />
          </form>
        ) : (
          <button type="button" className={tab(false)} onClick={() => setNaming(true)} title="지금 필터를 보기로 저장">
            <Plus className="size-3.5" />
            보기로 저장
          </button>
        ))}
    </div>
  );
}
