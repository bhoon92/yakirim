import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { EmojiTile } from '@/components/ui/emoji-tile';
import { Input } from '@/components/ui/input';
import { loadEmojiIndex } from '@/lib/emoji/emoji-index';
import { searchEmoji, type EmojiEntry } from '@/lib/emoji/search';
import type { EmojiKind } from '@/lib/tile';

/** 검색어가 없을 때 먼저 보여주는 것 — 교회에서 자주 쓰는 것 위주. */
const SUGGESTED = ['⛪️', '🙏', '✝️', '📖', '🕊️', '🎵', '🎉', '🏠', '🌱', '🔥', '❤️', '🤝', '🌍', '✈️', '🍞', '🎓', '📅', '👶', '🧑‍🤝‍🧑', '☕️'];

/**
 * 노션의 페이지 아이콘처럼 — 타일을 누르면 이모지를 골라 바꾼다. "자동" 을 누르면 이름으로 정해지는 기본값으로 돌아간다.
 * `editable` 이 아니면 그냥 타일만 보여준다(읽기 권한).
 */
export function IconPicker({
  value,
  seed,
  kind,
  size = 'sm',
  editable,
  onChange,
}: {
  value: string | null;
  seed: string;
  kind: EmojiKind;
  size?: 'xs' | 'sm' | 'md';
  editable: boolean;
  onChange: (icon: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EmojiEntry[] | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void loadEmojiIndex().then(index => {
      if (alive) setResults(query.trim() ? searchEmoji(index, query, 40) : null);
    });
    return () => {
      alive = false;
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const tile = <EmojiTile seed={seed} kind={kind} emoji={value ?? undefined} size={size} />;
  if (!editable) return tile;

  const choose = (icon: string | null) => {
    onChange(icon);
    setOpen(false);
    setQuery('');
  };
  const shown = results ?? SUGGESTED.map(emoji => ({ emoji, label: '', keys: [] }));

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title="아이콘 바꾸기"
        aria-label="아이콘 바꾸기"
        aria-expanded={open}
        onClick={event => {
          event.stopPropagation(); // 카드·행을 여는 클릭과 겹치지 않게
          setRect(buttonRef.current?.getBoundingClientRect() ?? null);
          setOpen(!open);
        }}
        className="shrink-0 rounded-[30%] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-[var(--color-foreground)]"
      >
        {tile}
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="아이콘 고르기"
            onClick={event => event.stopPropagation()}
            className="fixed z-[1000] w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2 shadow-lg"
            style={{ left: Math.min(rect.left, window.innerWidth - 296), top: rect.bottom + 6 }}
          >
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                emoji={false}
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="찾기 (예: 기도, 교회, pray)"
                className="h-8 text-sm"
              />
              <button
                type="button"
                onClick={() => choose(null)}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                title="이름으로 자동으로 정하기"
              >
                자동
              </button>
            </div>
            <div className="mt-2 grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
              {shown.map(entry => (
                <button
                  key={entry.emoji}
                  type="button"
                  title={entry.label || undefined}
                  onClick={() => choose(entry.emoji)}
                  className={`flex size-8 items-center justify-center rounded-md text-lg hover:bg-[var(--color-muted)] ${entry.emoji === value ? 'bg-[var(--color-muted)]' : ''}`}
                >
                  {entry.emoji}
                </button>
              ))}
              {results?.length === 0 && (
                <p className="col-span-8 py-4 text-center text-xs text-[var(--color-muted-foreground)]">찾는 이모지가 없습니다</p>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
