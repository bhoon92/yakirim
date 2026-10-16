import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  createResidentStatus,
  deleteResidentStatus,
  listResidentStatuses,
  RESIDENT_PHASE_LABEL,
  updateResidentStatus,
  type ResidentPhase,
  type ResidentStatus,
} from '@/api/residents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isSubmitEnter } from '@/lib/keyboard';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/permissions';

const PHASES: ResidentPhase[] = ['preparing', 'resident', 'left'];

/** 구간 고르기 — 노션 status 의 묶음(할 일/진행 중/완료)처럼. */
function PhaseSelect({
  value,
  onChange,
  disabled,
}: {
  value: ResidentPhase;
  onChange: (phase: ResidentPhase) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={event => onChange(event.target.value as ResidentPhase)}
      className="h-7 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-1.5 text-xs"
      aria-label="구간"
    >
      {PHASES.map(phase => (
        <option key={phase} value={phase}>
          {RESIDENT_PHASE_LABEL[phase]}
        </option>
      ))}
    </select>
  );
}

/**
 * 간사 상태 관리 — 노션 칸반의 status 처럼 이름·순서·구간을 교회가 정한다.
 * 코드가 아는 건 구간뿐이다: 진입 준비(지원·면담·과정 …) / 간사(공동체 집계) / 떠남.
 */
export function ResidentStatusManagerModal({ onClose }: { onClose: () => void }) {
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
          <h2 className="text-base font-semibold">간사 상태 관리</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
            <X />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <StatusList />
        </div>
      </div>
    </div>
  );
}

function StatusList() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('settings:write');
  const [adding, setAdding] = useState(false);

  const { data: statuses = [], isLoading } = useQuery({ queryKey: ['resident', 'statuses'], queryFn: listResidentStatuses });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['resident', 'statuses'] });
    queryClient.invalidateQueries({ queryKey: ['residents'] });
  };

  const patchMut = useMutation({
    mutationFn: (vars: { id: number; payload: Partial<ResidentStatus> }) => updateResidentStatus(vars.id, vars.payload),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`변경 실패: ${error.message}`),
  });

  // 순서 바꾸기 — 두 상태의 위치를 맞바꾸고 전체를 0부터 다시 매긴다(겹친 sortOrder 정리)
  const reorderMut = useMutation({
    mutationFn: async (ordered: ResidentStatus[]) => {
      await Promise.all(
        ordered.map((status, index) => (status.sortOrder === index ? null : updateResidentStatus(status.id, { sortOrder: index })))
      );
    },
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`순서 변경 실패: ${error.message}`),
  });
  const swap = (from: number, to: number) => {
    if (to < 0 || to >= statuses.length) return;
    const ordered = [...statuses];
    [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
    reorderMut.mutate(ordered);
  };

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteResidentStatus(id),
    onSuccess: invalidate,
    // 쓰이고 있는 상태는 서버가 409 로 막는다. 지우는 대신 비활성화하라고 안내한다.
    onError: (error: Error) =>
      window.alert(
        `${error.message}\n\n지울 수 없다면 눈 아이콘으로 비활성화하세요 — 새로 고를 수만 없게 되고 기존 기록은 그대로 남습니다.`
      ),
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--color-muted-foreground)]">
        상태 이름·순서·구간은 교회에 맞게 바꾸세요(이름을 누르면 고칩니다). <strong>간사</strong> 구간에 있는 사람만 공동체 인원으로 셉니다.
        진입 준비에서 간사로 옮기면 헌신일·입주일이, 간사에서 벗어나면 퇴소일이 비어 있을 때 그날로 채워집니다.
      </p>

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</p>
      ) : (
        <ul className="space-y-2">
          {statuses.map((status, index) => (
            <li
              key={status.id}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2.5',
                !status.isActive && 'opacity-50'
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <StatusName status={status} editable={canWrite} onRename={name => patchMut.mutate({ id: status.id, payload: { name } })} />
              </div>
              {canWrite && (
                <div className="flex shrink-0 items-center gap-1">
                  <PhaseSelect value={status.phase} onChange={phase => patchMut.mutate({ id: status.id, payload: { phase } })} />
                  <button
                    onClick={() => swap(index, index - 1)}
                    disabled={index === 0}
                    className="rounded-full p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-30"
                    aria-label={`${status.name} 위로`}
                    title="위로"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    onClick={() => swap(index, index + 1)}
                    disabled={index === statuses.length - 1}
                    className="rounded-full p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-30"
                    aria-label={`${status.name} 아래로`}
                    title="아래로"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    onClick={() => patchMut.mutate({ id: status.id, payload: { isActive: !status.isActive } })}
                    className="rounded-full p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
                    aria-label={status.isActive ? '비활성화' : '활성화'}
                    title={status.isActive ? '비활성화' : '활성화'}
                  >
                    {status.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`"${status.name}" 상태를 삭제할까요?\n이 상태를 쓰는 간사나 이력이 있으면 삭제되지 않습니다.`)) {
                        deleteMut.mutate(status.id);
                      }
                    }}
                    disabled={deleteMut.isPending}
                    className="rounded-full p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-destructive)]"
                    aria-label={`${status.name} 삭제`}
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
          <StatusForm
            nextSortOrder={statuses.length}
            onDone={() => {
              invalidate();
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            상태 추가
          </Button>
        ))}
    </div>
  );
}

/** 이름을 누르면 그 자리에서 고친다 (노션 status 이름 바꾸기처럼). */
function StatusName({ status, editable, onRename }: { status: ResidentStatus; editable: boolean; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(status.name);
  if (!editable || !editing) {
    return (
      <button
        type="button"
        disabled={!editable}
        onClick={() => {
          setValue(status.name);
          setEditing(true);
        }}
        className="truncate text-left text-sm font-medium enabled:hover:underline"
        title={editable ? '이름 바꾸기' : undefined}
      >
        {status.name}
      </button>
    );
  }
  const commit = () => {
    const next = value.trim();
    if (next && next !== status.name) onRename(next);
    setEditing(false);
  };
  return (
    <Input
      autoFocus
      value={value}
      maxLength={40}
      onChange={event => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Escape') setEditing(false);
        if (isSubmitEnter(event)) {
          event.preventDefault();
          commit();
        }
      }}
      className="h-8 text-sm"
    />
  );
}

function StatusForm({ nextSortOrder, onDone, onCancel }: { nextSortOrder: number; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<ResidentPhase>('preparing');

  const createMut = useMutation({
    mutationFn: () => createResidentStatus({ name: name.trim(), phase, sortOrder: nextSortOrder }),
    onSuccess: onDone,
    onError: (error: Error) => window.alert(`상태 추가 실패: ${error.message}`),
  });

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-[var(--color-border)] p-3">
      <Input placeholder="상태 이름 (예: 2차 면담, 휴직)" value={name} onChange={event => setName(event.target.value)} />
      <label className="flex items-center gap-2 text-xs">
        구간
        <PhaseSelect value={phase} onChange={setPhase} />
        <span className="text-[var(--color-muted-foreground)]">간사 구간만 공동체 인원으로 셉니다</span>
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
