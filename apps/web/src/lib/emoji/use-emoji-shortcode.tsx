import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { loadEmojiIndex } from './emoji-index';
import { detectShortcode, searchEmoji, type EmojiEntry } from './search';

type Field = HTMLInputElement | HTMLTextAreaElement;
type Open = { start: number; results: EmojiEntry[]; active: number; rect: DOMRect };

/** React 가 관리하는 입력칸 값을 바꾸고 onChange 가 불리게 한다 (controlled input 대응). */
function setFieldValue(field: Field, value: string) {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * 노션처럼 입력칸에서 `:기도` → 🙏. 입력칸에 `ref` 를 달고 `popup` 을 함께 렌더하면 된다.
 *
 * 키는 입력칸에 직접 단 리스너로 먼저 받는다 — 목록이 열려 있을 때 Enter·Esc 가 입력칸의 원래 동작
 * (저장·닫기)으로 새지 않게 막는다. 한글 조합 중 Enter 는 고르지 않는다(조합 확정용, lib/keyboard.ts 와 같은 이유).
 */
export function useEmojiShortcode<T extends Field>(enabled = true): { ref: (field: T | null) => void; popup: ReactNode } {
  const [field, setField] = useState<T | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const openRef = useRef<Open | null>(null);
  useLayoutEffect(() => {
    openRef.current = open;
  });
  const requestId = useRef(0);

  const close = useCallback(() => setOpen(null), []);

  const pick = useCallback(
    (entry: EmojiEntry) => {
      const current = openRef.current;
      if (!field || !current) return;
      const caret = field.selectionStart ?? field.value.length;
      const next = field.value.slice(0, current.start) + entry.emoji + field.value.slice(caret);
      setOpen(null);
      setFieldValue(field, next);
      const position = current.start + entry.emoji.length;
      field.setSelectionRange(position, position);
    },
    [field]
  );

  useEffect(() => {
    if (!field || !enabled) return;

    const refresh = () => {
      const match = detectShortcode(field.value, field.selectionStart ?? field.value.length);
      const id = ++requestId.current;
      if (!match) return setOpen(null);
      void loadEmojiIndex().then(index => {
        if (id !== requestId.current) return; // 그새 더 쳤다
        const results = searchEmoji(index, match.query);
        // 한글 조합 중 잠깐 결과가 비면 목록을 깜빡이지 않고 그대로 둔다
        if (results.length === 0) return setOpen(previous => (previous && match.query.length > 1 ? previous : null));
        setOpen({ start: match.start, results, active: 0, rect: field.getBoundingClientRect() });
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const current = openRef.current;
      if (!current) return;
      const swallow = () => {
        event.preventDefault();
        event.stopPropagation();
      };
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        swallow();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setOpen({ ...current, active: (current.active + step + current.results.length) % current.results.length });
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        swallow();
        if (event.isComposing || event.keyCode === 229) return; // 조합 확정용 Enter — 다음 Enter 로 고른다
        pick(current.results[current.active]);
      } else if (event.key === 'Escape') {
        swallow();
        close();
      }
    };

    const onBlur = () => close();
    const target: HTMLElement = field;
    target.addEventListener('input', refresh);
    target.addEventListener('click', refresh);
    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('blur', onBlur);
    return () => {
      target.removeEventListener('input', refresh);
      target.removeEventListener('click', refresh);
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('blur', onBlur);
    };
  }, [field, enabled, pick, close]);

  const popup =
    open &&
    createPortal(
      <ul
        role="listbox"
        aria-label="이모지"
        className="fixed z-[1000] w-64 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] py-1 text-sm shadow-lg"
        style={{ left: open.rect.left, top: open.rect.bottom + 4 }}
      >
        {open.results.map((entry, index) => (
          <li
            key={entry.emoji}
            role="option"
            aria-selected={index === open.active}
            // mousedown 에서 막아야 입력칸 포커스가 안 빠지고(blur → 닫힘) 고를 수 있다
            onMouseDown={event => {
              event.preventDefault();
              pick(entry);
            }}
            onMouseEnter={() => setOpen({ ...open, active: index })}
            className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 ${index === open.active ? 'bg-[var(--color-muted)]' : ''}`}
          >
            <span className="text-lg leading-none">{entry.emoji}</span>
            <span className="truncate">{entry.label}</span>
          </li>
        ))}
      </ul>,
      document.body
    );

  return { ref: setField as (field: T | null) => void, popup };
}
