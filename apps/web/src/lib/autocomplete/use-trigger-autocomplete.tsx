import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { detectTrigger } from './detect-trigger';

type Field = HTMLInputElement | HTMLTextAreaElement;
type Open<T> = { start: number; results: T[]; active: number; rect: DOMRect };

/** React 가 관리하는 입력칸 값을 바꾸고 onChange 가 불리게 한다 (controlled input 대응). */
function setFieldValue(field: Field, value: string) {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

export type TriggerAutocompleteOptions<T> = {
  enabled?: boolean;
  /** `:` 이모지, `@` 멘션 */
  trigger: string;
  /** 검색어 → 후보. 늦게 온 응답은 버린다. */
  search: (query: string) => Promise<T[]>;
  getKey: (item: T) => string | number;
  renderItem: (item: T) => ReactNode;
  /** 고른 항목이 `{trigger}검색어` 자리에 들어갈 글자 */
  toText: (item: T) => string;
  onPick?: (item: T) => void;
  label: string;
};

/**
 * 입력칸에서 트리거 글자 뒤 검색어로 후보를 띄우고 고르면 바꿔 넣는다 — 노션의 `:` 이모지, `@` 멘션.
 * 입력칸에 `ref` 를 달고 `popup` 을 함께 렌더하면 된다. 한 입력칸에 트리거가 다른 것을 여러 개 달아도 된다.
 *
 * 키는 입력칸에 직접 단 리스너로 먼저 받는다 — 목록이 열려 있을 때 Enter·Esc 가 입력칸의 원래 동작
 * (저장·닫기)으로 새지 않게 막는다. 한글 조합 중 Enter 는 고르지 않는다(조합 확정용, lib/keyboard.ts 와 같은 이유).
 */
export function useTriggerAutocomplete<F extends Field, T>(
  options: TriggerAutocompleteOptions<T>
): { ref: (field: F | null) => void; popup: ReactNode } {
  const { enabled = true, trigger } = options;
  const [field, setField] = useState<F | null>(null);
  const [open, setOpen] = useState<Open<T> | null>(null);
  const openRef = useRef<Open<T> | null>(null);
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    openRef.current = open;
    optionsRef.current = options;
  });
  const requestId = useRef(0);

  const close = useCallback(() => setOpen(null), []);

  const pick = useCallback(
    (item: T) => {
      const current = openRef.current;
      if (!field || !current) return;
      const caret = field.selectionStart ?? field.value.length;
      const text = optionsRef.current.toText(item);
      const next = field.value.slice(0, current.start) + text + field.value.slice(caret);
      setOpen(null);
      setFieldValue(field, next);
      const position = current.start + text.length;
      field.setSelectionRange(position, position);
      optionsRef.current.onPick?.(item);
    },
    [field]
  );

  useEffect(() => {
    if (!field || !enabled) return;

    const refresh = () => {
      const match = detectTrigger(field.value, field.selectionStart ?? field.value.length, trigger);
      const id = ++requestId.current;
      if (!match) return setOpen(null);
      void optionsRef.current.search(match.query).then(results => {
        if (id !== requestId.current) return; // 그새 더 쳤다
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
  }, [field, enabled, trigger, pick, close]);

  const popup =
    open &&
    createPortal(
      <ul
        role="listbox"
        aria-label={options.label}
        className="fixed z-[1000] w-64 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] py-1 text-sm shadow-lg"
        style={{ left: open.rect.left, top: open.rect.bottom + 4 }}
      >
        {open.results.map((item, index) => (
          <li
            key={options.getKey(item)}
            role="option"
            aria-selected={index === open.active}
            // mousedown 에서 막아야 입력칸 포커스가 안 빠지고(blur → 닫힘) 고를 수 있다
            onMouseDown={event => {
              event.preventDefault();
              pick(item);
            }}
            onMouseEnter={() => setOpen({ ...open, active: index })}
            className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 ${index === open.active ? 'bg-[var(--color-muted)]' : ''}`}
          >
            {options.renderItem(item)}
          </li>
        ))}
      </ul>,
      document.body
    );

  return { ref: setField as (field: F | null) => void, popup };
}
