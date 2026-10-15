import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, EyeOff, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { createStage, deleteStage, listStages, updateStage, type MissionaryStage } from '@/api/missionary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/permissions';

/**
 * 선교사 단계 관리 — 파송 절차가 교회마다 달라 이름·순서·개수를 교회가 직접 정한다.
 * 코드가 아는 규약은 "파송 집계"(countsAsActive) 하나뿐이라 그것만 별도 토글로 노출한다.
 */
export function MissionaryStageManagerModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-[var(--color-background)] shadow-md"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="text-base font-semibold">선교사 단계 관리</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
            <X />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <StageList />
        </div>
      </div>
    </div>
  );
}

function StageList() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('settings:write');
  const [adding, setAdding] = useState(false);

  const { data: stages = [], isLoading } = useQuery({ queryKey: ['missionary', 'stages'], queryFn: listStages });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['missionary', 'stages'] });
    queryClient.invalidateQueries({ queryKey: ['missionaries'] });
  };

  const patchMut = useMutation({
    mutationFn: (vars: { id: number; payload: Partial<MissionaryStage> }) => updateStage(vars.id, vars.payload),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`변경 실패: ${error.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteStage(id),
    onSuccess: invalidate,
    // 쓰이고 있는 단계는 서버가 409 로 막는다. 지우는 대신 비활성화하라고 안내한다.
    onError: (error: Error) =>
      window.alert(
        `${error.message}\n\n지울 수 없다면 눈 아이콘으로 비활성화하세요 — 새로 고를 수만 없게 되고 기존 기록은 그대로 남습니다.`
      ),
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--color-muted-foreground)]">
        단계 이름과 순서는 교회에 맞게 바꾸세요. <strong>파송 집계</strong>를 켠 단계에 있는 사람이 대시보드 “현재 파송”에 잡히고,
        재적상태가 “파송”으로 바뀌어 출석 명단에서 빠집니다.
      </p>

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</p>
      ) : (
        <ul className="space-y-2">
          {stages.map(stage => (
            <li
              key={stage.id}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2.5',
                !stage.isActive && 'opacity-50'
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{stage.name}</span>
                {stage.countsAsActive && <Badge tone="success">파송 집계</Badge>}
              </div>
              {canWrite && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => patchMut.mutate({ id: stage.id, payload: { countsAsActive: !stage.countsAsActive } })}
                    className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] transition-colors hover:bg-[var(--color-muted)]"
                    title="대시보드 '현재 파송' 집계에 포함할지"
                  >
                    {stage.countsAsActive ? '집계 해제' : '집계 포함'}
                  </button>
                  <button
                    onClick={() => patchMut.mutate({ id: stage.id, payload: { isActive: !stage.isActive } })}
                    className="rounded-full p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
                    aria-label={stage.isActive ? '비활성화' : '활성화'}
                    title={stage.isActive ? '비활성화' : '활성화'}
                  >
                    {stage.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`"${stage.name}" 단계를 삭제할까요?\n이 단계를 쓰는 선교사나 기록이 있으면 삭제되지 않습니다.`)) {
                        deleteMut.mutate(stage.id);
                      }
                    }}
                    disabled={deleteMut.isPending}
                    className="rounded-full p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-destructive)]"
                    aria-label={`${stage.name} 삭제`}
                    title="삭제"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite &&
        (adding ? (
          <StageForm
            nextSortOrder={stages.length}
            onDone={() => {
              invalidate();
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            단계 추가
          </Button>
        ))}
    </div>
  );
}

function StageForm({ nextSortOrder, onDone, onCancel }: { nextSortOrder: number; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [countsAsActive, setCountsAsActive] = useState(false);

  const createMut = useMutation({
    mutationFn: () => createStage({ name: name.trim(), countsAsActive, sortOrder: nextSortOrder }),
    onSuccess: onDone,
    onError: (error: Error) => window.alert(`단계 추가 실패: ${error.message}`),
  });

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-[var(--color-border)] p-3">
      <Input placeholder="단계 이름 (예: 현지 정착)" value={name} onChange={event => setName(event.target.value)} />
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={countsAsActive}
          onChange={event => setCountsAsActive(event.target.checked)}
          className="size-4 accent-[var(--color-foreground)]"
        />
        이 단계를 “현재 파송”으로 집계
      </label>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button size="sm" onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}>
          <Check className="size-3.5" />
          추가
        </Button>
      </div>
    </div>
  );
}
