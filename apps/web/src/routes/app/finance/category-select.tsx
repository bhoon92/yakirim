import { useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';

import type { Category } from '@/api/finance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isSubmitEnter } from '@/lib/keyboard';

/** 카테고리 알약 선택 + 인라인 추가/편집 (헌금 종류 / 계정과목 공용). */
export function CategorySelect({
  categories,
  value,
  onChange,
  onCreate,
  creating,
  onUpdate,
  onDelete,
}: {
  categories: Category[];
  value: number | null;
  onChange: (id: number) => void;
  onCreate?: (name: string) => void;
  creating?: boolean;
  onUpdate?: (id: number, name: string) => void;
  onDelete?: (id: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const cancelRef = useRef(false);
  const canManage = Boolean(onUpdate && onDelete);

  // 단일 커밋 경로: Enter/blur 모두 blur로 수렴시켜 이중 생성 방지. Escape는 취소 플래그로 구분.
  const commitCreate = () => {
    setAdding(false);
    const trimmed = name.trim();
    setName('');
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    if (trimmed) onCreate?.(trimmed);
  };

  const commitRename = () => {
    const id = editId;
    const trimmed = editName.trim();
    setEditId(null);
    setEditName('');
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    const original = categories.find(category => category.id === id);
    if (id != null && trimmed && trimmed !== original?.name) onUpdate?.(id, trimmed);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {categories.map(category =>
        editing && editId === category.id ? (
          <Input
            key={category.id}
            value={editName}
            onChange={event => setEditName(event.target.value)}
            autoFocus
            maxLength={20}
            className="h-8 w-28"
            onBlur={commitRename}
            onKeyDown={event => {
              if (isSubmitEnter(event)) event.currentTarget.blur();
              if (event.key === 'Escape') {
                cancelRef.current = true;
                event.currentTarget.blur();
              }
            }}
          />
        ) : (
          <span
            key={category.id}
            className={cn(
              'inline-flex items-center rounded-full border text-xs font-medium transition-colors',
              !editing && value === category.id
                ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
                : 'border-[var(--color-border)]'
            )}
          >
            <button
              type="button"
              onClick={() => (editing ? (setEditId(category.id), setEditName(category.name)) : onChange(category.id))}
              className={cn(
                'rounded-full px-3 py-1',
                !editing && (value === category.id ? 'hover:opacity-90' : 'hover:bg-[var(--color-muted)]')
              )}
            >
              {category.name}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`'${category.name}' 분류를 삭제할까요?`)) onDelete?.(category.id);
                }}
                className="pr-2 pl-0.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"
                aria-label="삭제"
              >
                <X className="size-3.5" />
              </button>
            )}
          </span>
        )
      )}

      {!editing &&
        onCreate &&
        (adding ? (
          <span className="inline-flex items-center gap-1">
            <Input
              value={name}
              onChange={event => setName(event.target.value)}
              autoFocus
              maxLength={20}
              placeholder="새 분류"
              className="h-8 w-28"
              onBlur={commitCreate}
              onKeyDown={event => {
                if (isSubmitEnter(event)) event.currentTarget.blur();
                if (event.key === 'Escape') {
                  cancelRef.current = true;
                  event.currentTarget.blur();
                }
              }}
            />
          </span>
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(true)} disabled={creating} className="h-8 text-xs">
            + 분류 추가
          </Button>
        ))}

      {canManage && categories.length > 0 && !adding && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(prev => !prev);
            setEditId(null);
          }}
          className="h-8 text-xs text-[var(--color-muted-foreground)]"
        >
          {editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
          {editing ? '완료' : '편집'}
        </Button>
      )}
    </div>
  );
}
