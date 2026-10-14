import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, EyeOff, GripVertical, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  copyReferenceYear,
  createReference,
  deleteReference,
  listReferences,
  REFERENCE_LABEL,
  updateReference,
  YEAR_SCOPED_KINDS,
  type Reference,
  type ReferenceKind,
} from '@/api/references';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/permissions';
import { isSubmitEnter } from '@/lib/keyboard';

/** 기준정보(기관·사역팀·공동체·사역 역할·예배·재적상태) 관리 — 탭 + 연도 + CRUD. 각 도메인 페이지에서 재사용. */
export function ReferenceManager({ kinds }: { kinds: ReferenceKind[] }) {
  const [tab, setTab] = useState<ReferenceKind>(kinds[0]);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const isYearScoped = YEAR_SCOPED_KINDS.has(tab);
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 border-b border-[var(--color-border)]">
        {kinds.length > 1 ? (
          <div className="flex flex-wrap gap-4">
            {kinds.map(tabOption => (
              <button
                key={tabOption}
                onClick={() => setTab(tabOption)}
                className={cn(
                  'relative -mb-px border-b-2 px-1 py-2.5 text-sm font-medium transition-colors',
                  tab === tabOption
                    ? 'border-[var(--color-foreground)] text-[var(--color-foreground)]'
                    : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
                )}
              >
                {REFERENCE_LABEL[tabOption]}
              </button>
            ))}
          </div>
        ) : (
          <div className="-mb-px border-b-2 border-[var(--color-foreground)] px-1 py-2.5 text-sm font-medium">{REFERENCE_LABEL[tab]}</div>
        )}

        {isYearScoped && (
          <div className="flex items-center gap-2 pb-1.5">
            <label htmlFor="reference-year" className="text-xs font-medium text-[var(--color-muted-foreground)]">
              편성 연도
            </label>
            <select
              id="reference-year"
              value={year}
              onChange={event => setYear(Number(event.target.value))}
              className="h-8 rounded-md bg-[var(--color-background)] px-2 text-sm shadow-[var(--shadow-input)] outline-none transition-shadow focus-visible:shadow-[var(--shadow-input-focus)]"
            >
              {yearOptions.map(option => (
                <option key={option} value={option}>
                  {option}년
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <ReferenceTab kind={tab} year={isYearScoped ? year : undefined} />
    </div>
  );
}

/** 모달로 띄우는 참조 관리. 페이지의 "관리" 버튼에서 사용. */
export function ReferenceManagerModal({ title, kinds, onClose }: { title: string; kinds: ReferenceKind[]; onClose: () => void }) {
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
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
            <X />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <ReferenceManager kinds={kinds} />
        </div>
      </div>
    </div>
  );
}

function ReferenceTab({ kind, year }: { kind: ReferenceKind; year?: number }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('settings:write');
  const queryKey = year != null ? ['references', kind, year] : ['references', kind];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listReferences(kind, year),
  });

  const createMut = useMutation({
    mutationFn: (payload: { name: string }) => createReference(kind, payload, year),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: error => window.alert(`추가 실패: ${error instanceof Error ? error.message : String(error)}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteReference(kind, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: error => window.alert(`삭제 실패: ${error instanceof Error ? error.message : String(error)}`),
  });

  // 빈 연도에 이전 연도(year-1) 구성을 복제.
  const copyMut = useMutation({
    mutationFn: () => copyReferenceYear(kind, year! - 1, year!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: error => window.alert(`복사 실패: ${error instanceof Error ? error.message : String(error)}`),
  });

  // 표시 순서(sortOrder)를 배열 위치 기준으로 다시 매겨, 바뀐 항목만 PATCH.
  const reorderMut = useMutation({
    mutationFn: async (ordered: Reference[]) => {
      await Promise.all(
        ordered
          .map((item, index) => (item.sortOrder === index ? null : updateReference(kind, item.id, { sortOrder: index })))
          .filter((promise): promise is Promise<Reference> => promise !== null)
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: error => window.alert(`순서 변경 실패: ${error instanceof Error ? error.message : String(error)}`),
  });

  const items = data ?? [];

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const clearDrag = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const ordered = [...items];
      const [moved] = ordered.splice(dragIndex, 1);
      ordered.splice(dragOverIndex, 0, moved);
      reorderMut.mutate(ordered);
    }
    clearDrag();
  };

  return (
    <div className="space-y-4">
      {canWrite && (
        <CreateRow
          label={REFERENCE_LABEL[kind]}
          onSubmit={name => createMut.mutate({ name })}
          pending={createMut.isPending}
          placeholder={`예: ${exampleFor(kind)}`}
        />
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">불러오는 중…</div>
          ) : items.length === 0 ? (
            <div className="space-y-3 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
              <p>
                {year != null ? `${year}년에 등록된 ` : '등록된 '}
                {REFERENCE_LABEL[kind]}이 없습니다.
              </p>
              {year != null && canWrite && (
                <Button variant="outline" size="sm" onClick={() => copyMut.mutate()} disabled={copyMut.isPending}>
                  {copyMut.isPending ? '복사 중…' : `${year - 1}년 구성 복사해오기`}
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {items.map((item, index) => (
                <ReferenceRow
                  key={item.id}
                  kind={kind}
                  item={item}
                  canWrite={canWrite}
                  reordering={reorderMut.isPending}
                  isDragging={dragIndex === index}
                  isDragOver={dragOverIndex === index && dragIndex !== index}
                  onDragStart={() => setDragIndex(index)}
                  onDragEnter={() => setDragOverIndex(index)}
                  onDrop={handleDrop}
                  onDragEnd={clearDrag}
                  onDelete={() => deleteMut.mutate(item.id)}
                  onChanged={() => queryClient.invalidateQueries({ queryKey })}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateRow({
  label,
  onSubmit,
  pending,
  placeholder,
}: {
  label: string;
  onSubmit: (name: string) => void;
  pending: boolean;
  placeholder: string;
}) {
  const [name, setName] = useState('');

  return (
    <Card>
      <form
        onSubmit={event => {
          event.preventDefault();
          if (!name.trim()) return;
          onSubmit(name.trim());
          setName('');
        }}
        className="flex items-end gap-3 p-4"
      >
        <label className="flex-1 space-y-1.5">
          <span className="block text-xs font-medium text-[var(--color-muted-foreground)]">{label} 추가</span>
          <Input value={name} onChange={event => setName(event.target.value)} placeholder={placeholder} maxLength={40} />
        </label>
        <Button type="submit" disabled={!name.trim() || pending}>
          <Plus className="size-4" />
          {pending ? '추가 중…' : '추가'}
        </Button>
      </form>
    </Card>
  );
}

function ReferenceRow({
  kind,
  item,
  canWrite,
  reordering,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
  onDelete,
  onChanged,
}: {
  kind: ReferenceKind;
  item: Reference;
  canWrite: boolean;
  reordering: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [grabbed, setGrabbed] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);
  const [descriptionDraft, setDescriptionDraft] = useState(item.description ?? '');
  // 재적상태만 정체 기준을 갖는다. 빈 문자열 = 판정 안 함(null).
  const isStage = kind === 'memberStatus';
  const [stallsDraft, setStallsDraft] = useState(item.stallsAfterDays == null ? '' : String(item.stallsAfterDays));

  const saveMut = useMutation({
    mutationFn: (payload: { name: string; description: string; stallsAfterDays?: number | null }) =>
      updateReference(kind, item.id, {
        name: payload.name,
        description: payload.description,
        ...(isStage ? { stallsAfterDays: payload.stallsAfterDays } : {}),
      }),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
  });

  const toggleActiveMut = useMutation({
    mutationFn: () => updateReference(kind, item.id, { isActive: !item.isActive }),
    onSuccess: () => onChanged(),
    onError: error => window.alert(`상태 변경 실패: ${error instanceof Error ? error.message : String(error)}`),
  });

  const startEditing = () => {
    setNameDraft(item.name);
    setDescriptionDraft(item.description ?? '');
    setStallsDraft(item.stallsAfterDays == null ? '' : String(item.stallsAfterDays));
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setNameDraft(item.name);
    setDescriptionDraft(item.description ?? '');
    setStallsDraft(item.stallsAfterDays == null ? '' : String(item.stallsAfterDays));
  };

  const submit = () => {
    const name = nameDraft.trim();
    const description = descriptionDraft.trim();
    if (!name) {
      cancelEditing();
      return;
    }
    const stalls = stallsDraft.trim() === '' ? null : Number(stallsDraft);
    const stallsUnchanged = !isStage || stalls === (item.stallsAfterDays ?? null);
    if (name === item.name && description === (item.description ?? '') && stallsUnchanged) {
      cancelEditing();
      return;
    }
    saveMut.mutate({ name, description, stallsAfterDays: stalls });
  };

  if (editing) {
    return (
      <li className="space-y-2 px-5 py-3">
        <Input
          value={nameDraft}
          onChange={event => setNameDraft(event.target.value)}
          autoFocus
          maxLength={40}
          placeholder="이름"
          onKeyDown={event => {
            if (isSubmitEnter(event)) submit();
            if (event.key === 'Escape') cancelEditing();
          }}
          className="h-9"
        />
        {isStage && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={3650}
              value={stallsDraft}
              onChange={event => setStallsDraft(event.target.value)}
              placeholder="정체 기준"
              onKeyDown={event => {
                if (isSubmitEnter(event)) submit();
                if (event.key === 'Escape') cancelEditing();
              }}
              className="h-9 w-28"
            />
            <p className="text-xs text-[var(--color-muted-foreground)]">
              이 단계에 이 일수 이상 머무르면 홈의 &ldquo;정체된 사람&rdquo;에 뜹니다. 비우면 판정하지 않습니다 — 파송·이명처럼 도착점인
              단계.
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            value={descriptionDraft}
            onChange={event => setDescriptionDraft(event.target.value)}
            maxLength={200}
            placeholder="설명 (선택)"
            onKeyDown={event => {
              if (isSubmitEnter(event)) submit();
              if (event.key === 'Escape') cancelEditing();
            }}
            className="h-9"
          />
          <Button size="icon" variant="ghost" onClick={submit} disabled={saveMut.isPending} aria-label="저장">
            <Check className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={cancelEditing} aria-label="취소">
            <X className="size-4" />
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li
      draggable={canWrite && grabbed}
      onDragStart={event => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', '');
        onDragStart();
      }}
      onDragEnter={onDragEnter}
      onDragOver={event => event.preventDefault()}
      onDrop={event => {
        event.preventDefault();
        onDrop();
      }}
      onDragEnd={() => {
        setGrabbed(false);
        onDragEnd();
      }}
      className={cn(
        'flex items-center gap-2 px-5 py-3 transition-colors',
        isDragging && 'opacity-40',
        isDragOver && 'bg-[var(--color-muted)]'
      )}
    >
      {canWrite && (
        <button
          type="button"
          aria-label="드래그하여 순서 변경"
          onMouseDown={() => !reordering && setGrabbed(true)}
          onMouseUp={() => setGrabbed(false)}
          className="cursor-grab text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <button
          onClick={() => canWrite && startEditing()}
          disabled={!canWrite}
          className={cn('block max-w-full truncate text-left text-sm font-medium', canWrite && 'hover:underline')}
        >
          {item.name}
        </button>
        {item.description && <p className="truncate text-xs text-[var(--color-muted-foreground)]">{item.description}</p>}
      </div>

      {isStage && item.stallsAfterDays != null && <Badge tone="warn">정체 {item.stallsAfterDays}일</Badge>}
      {!item.isActive && <Badge tone="muted">비활성</Badge>}

      {canWrite && (
        <>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => toggleActiveMut.mutate()}
            disabled={toggleActiveMut.isPending}
            aria-label={item.isActive ? '비활성화' : '활성화'}
            title={item.isActive ? '비활성화' : '활성화'}
          >
            {item.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4 text-[var(--color-muted-foreground)]" />}
          </Button>
          {/* 시스템 항목은 서버가 어차피 막는다 — 눌러 보고 알게 하지 않고 아예 못 누르게 한다. */}
          <Button
            size="icon"
            variant="ghost"
            disabled={Boolean(item.systemKey)}
            title={item.systemKey ? '코드가 참조하는 항목이라 삭제할 수 없습니다 (비활성화는 가능)' : '삭제'}
            onClick={() => {
              if (window.confirm(`"${item.name}" 을(를) 삭제할까요?\n사용 중이면 삭제되지 않고 이유를 알려 드립니다.`)) onDelete();
            }}
            aria-label="삭제"
          >
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </li>
  );
}

function exampleFor(kind: ReferenceKind): string {
  switch (kind) {
    case 'department':
      return '본부 / 더키즈 / 카페';
    case 'ministry':
      return '예배팀 / 미디어팀 / 해외선교팀';
    case 'smallGroup':
      return '1하우스 / 2하우스';
    case 'position':
      return '목사 / 전도사 / 간사 / 팀장';
    case 'worshipService':
      return '주일예배 / 다음세대예배 / 금요기도회';
    case 'memberStatus':
      return '방문 / 새가족 / 정착 / 훈련생 / 사역자 / 파송';
    case 'careNoteType':
      return '심방 / 면담 / 양육 / 상담';
  }
}
