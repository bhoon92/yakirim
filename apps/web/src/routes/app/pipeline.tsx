import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { List } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { Link } from 'react-router';

import { fetchPipeline, updateMember, type PipelineCard, type PipelineColumn } from '@/api/members';
import { PageHeader } from '@/components/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { MemberDetailModal } from './member-detail-modal';

const BOARD_KEY = ['members', 'pipeline'] as const;

/**
 * 양성 파이프라인 보드 — 노션의 보드 보기처럼 재적상태별 칸에 교인 카드.
 * 카드를 다른 칸으로 끌어다 놓으면 단계가 바뀌고 이력이 남는다(교인 수정과 같은 경로).
 * 폰에서는 끌기가 안 되니 카드를 눌러 교인 카드에서 바꾼다.
 */
export function PipelinePage() {
  const { can } = usePermissions();
  const canWrite = can('member:write');
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);
  const [dragging, setDragging] = useState<{ card: PipelineCard; from: number } | null>(null);
  const [overColumn, setOverColumn] = useState<number | null>(null);

  const { data: columns = [], isLoading } = useQuery({ queryKey: BOARD_KEY, queryFn: fetchPipeline });

  const moveMut = useMutation({
    mutationFn: ({ card, to }: { card: PipelineCard; from: number; to: number }) => updateMember(card.id, { statusId: to }),
    // 놓는 즉시 옮겨 보인다 — 실패하면 되돌린다
    onMutate: async ({ card, from, to }) => {
      await queryClient.cancelQueries({ queryKey: BOARD_KEY });
      const previous = queryClient.getQueryData<PipelineColumn[]>(BOARD_KEY);
      queryClient.setQueryData<PipelineColumn[]>(BOARD_KEY, current =>
        current?.map(column => {
          if (column.statusId === from) {
            return {
              ...column,
              count: column.count - 1,
              stalledCount: column.stalledCount - (card.stalled ? 1 : 0),
              members: column.members.filter(item => item.id !== card.id),
            };
          }
          if (column.statusId === to) {
            const moved = { ...card, days: 0, stalled: false, since: null };
            return { ...column, count: column.count + 1, members: [moved, ...column.members] };
          }
          return column;
        })
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(BOARD_KEY, context.previous);
      window.alert('단계를 옮기지 못했습니다. 다시 시도해 주세요.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BOARD_KEY });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });

  const onDrop = (event: DragEvent, to: number) => {
    event.preventDefault();
    setOverColumn(null);
    if (dragging && dragging.from !== to) moveMut.mutate({ card: dragging.card, from: dragging.from, to });
    setDragging(null);
  };

  const total = columns.reduce((sum, column) => sum + column.count, 0);
  const stalled = columns.reduce((sum, column) => sum + column.stalledCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="양성"
        title="파이프라인"
        description={
          canWrite ? '교인을 단계별로 봅니다. 카드를 다른 칸으로 끌어다 놓으면 단계가 바뀌고 이력이 남습니다.' : '교인을 단계별로 봅니다.'
        }
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/app/members">
              <List className="size-4" />
              목록으로 보기
            </Link>
          </Button>
        }
      />

      {!isLoading && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          총 {total}명{stalled > 0 && <span className="font-medium text-[var(--color-destructive,#dc2626)]"> · 정체 {stalled}명</span>}
        </p>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-3">
          {isLoading && <p className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</p>}
          {columns.map(column => (
            <section
              key={column.statusId}
              aria-label={`${column.name} 단계`}
              onDragOver={event => {
                if (!dragging) return;
                event.preventDefault();
                setOverColumn(column.statusId);
              }}
              onDragLeave={() => setOverColumn(current => (current === column.statusId ? null : current))}
              onDrop={event => onDrop(event, column.statusId)}
              className={cn(
                'flex w-64 shrink-0 flex-col rounded-xl bg-[var(--color-muted)] p-2 transition-shadow',
                overColumn === column.statusId && dragging?.from !== column.statusId && 'ring-2 ring-[var(--color-foreground)]'
              )}
            >
              <header className="flex items-baseline justify-between px-1.5 pb-2">
                <h2 className="text-sm font-semibold">
                  {column.name} <span className="font-normal text-[var(--color-muted-foreground)]">{column.count}</span>
                </h2>
                {column.stalledCount > 0 && (
                  <span
                    className="text-xs font-medium text-[var(--color-destructive,#dc2626)]"
                    title={`${column.stallsAfterDays}일 넘게 머문 사람`}
                  >
                    정체 {column.stalledCount}
                  </span>
                )}
              </header>
              <ul className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto">
                {column.members.map(card => (
                  <li key={card.id}>
                    <button
                      type="button"
                      draggable={canWrite}
                      onDragStart={event => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', String(card.id));
                        setDragging({ card, from: column.statusId });
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOverColumn(null);
                      }}
                      onClick={() => setOpenId(card.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg bg-[var(--color-background)] px-2.5 py-2 text-left shadow-sm transition-opacity',
                        canWrite && 'cursor-grab active:cursor-grabbing',
                        dragging?.card.id === card.id && 'opacity-40'
                      )}
                    >
                      <Avatar name={card.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{card.name}</span>
                        <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
                          {card.days !== null ? `${card.days}일째` : '기록 없음'}
                          {card.shepherdName && ` · ${card.shepherdName}`}
                        </span>
                      </span>
                      {card.stalled && (
                        <span className="shrink-0 rounded-full bg-[var(--color-destructive,#dc2626)]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-destructive,#dc2626)]">
                          정체
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                {column.count > column.members.length && (
                  <li className="px-1.5 py-1 text-xs text-[var(--color-muted-foreground)]">
                    외 {column.count - column.members.length}명 —{' '}
                    <Link to={`/app/members?statusId=${column.statusId}`} className="underline">
                      목록에서 보기
                    </Link>
                  </li>
                )}
                {column.count === 0 && <li className="px-1.5 py-3 text-center text-xs text-[var(--color-muted-foreground)]">비어 있음</li>}
              </ul>
            </section>
          ))}
        </div>
      </div>

      {openId !== null && <MemberDetailModal memberId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
