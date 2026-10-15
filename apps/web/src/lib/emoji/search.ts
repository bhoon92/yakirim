import { detectTrigger } from '@/lib/autocomplete/detect-trigger';
/**
 * 노션처럼 `:이름` 으로 이모지를 넣는 기능의 순수 로직 — 트리거 감지와 검색 순위.
 * 데이터는 emoji-index.ts 가 처음 쓸 때 불러온다.
 */

export type EmojiEntry = {
  emoji: string;
  /** 한국어 이름 (예: "기도") */
  label: string;
  /** 검색어 — 한국어 태그 + 영어 단축어(github 식, 예: "pray") */
  keys: string[];
};

export type { TriggerMatch as ShortcodeMatch } from '@/lib/autocomplete/detect-trigger';

/** `:검색어` 찾기 — detectTrigger 의 이모지 판. */
export function detectShortcode(value: string, caret: number) {
  return detectTrigger(value, caret, ':');
}

/** 한글 조합 중인 마지막 낱자(ㄱ~ㅎ, ㅏ~ㅣ)는 아직 글자가 아니라 검색에서 뺀다 — ":하ㅌ" → "하" */
function settledQuery(query: string): string {
  return query.replace(/[ㄱ-ㆎ]+$/, '');
}

/**
 * 순위: 이름이 똑같음 → 이름이 그걸로 시작 → 태그·단축어가 똑같음 → 태그·단축어가 그걸로 시작
 * → 이름에 들어 있음 → 태그·단축어에 들어 있음. 같은 순위면 유니코드 순서(데이터 순서).
 */
export function searchEmoji(index: EmojiEntry[], rawQuery: string, limit = 8): EmojiEntry[] {
  const query = settledQuery(rawQuery.trim().toLowerCase());
  if (!query) return [];

  const scored: { entry: EmojiEntry; score: number; order: number }[] = [];
  index.forEach((entry, order) => {
    const label = entry.label.toLowerCase();
    let score: number;
    if (label === query) score = 0;
    else if (label.startsWith(query)) score = 1;
    else if (entry.keys.some(key => key === query)) score = 2;
    else if (entry.keys.some(key => key.startsWith(query))) score = 3;
    else if (label.includes(query)) score = 4;
    else if (entry.keys.some(key => key.includes(query))) score = 5;
    else return;
    scored.push({ entry, score, order });
  });

  return scored
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .slice(0, limit)
    .map(item => item.entry);
}
