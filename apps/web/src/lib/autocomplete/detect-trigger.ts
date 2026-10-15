export type TriggerMatch = {
  /** 트리거 글자(`:`·`@`)의 위치 — 고르면 여기부터 커서까지를 바꾼다 */
  start: number;
  query: string;
};

/**
 * 커서 앞 글자에서 `{trigger}검색어` 를 찾는다.
 * 트리거 앞은 줄 처음이거나 공백이어야 한다 — "10:30", "a@b.com", "https://" 에서 뜨지 않게.
 * 숫자만 있는 검색어도 무시한다.
 */
export function detectTrigger(value: string, caret: number, trigger: string): TriggerMatch | null {
  const before = value.slice(0, caret);
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\s)${escaped}([^\\s${escaped}]{1,30})$`).exec(before);
  if (!match) return null;
  const query = match[1];
  if (/^\d+$/.test(query)) return null;
  return { start: caret - query.length - 1, query };
}
