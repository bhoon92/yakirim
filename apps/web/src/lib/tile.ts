/**
 * 파스텔 타일 색·이모지를 문자열에서 결정론적으로 뽑는다.
 *
 * flex 는 문서·구성원마다 색과 이모지가 붙어 목록이 한눈에 구분된다. 그걸 DB 컬럼 없이 흉내내려면
 * "같은 대상은 항상 같은 색·이모지"가 보장돼야 한다 — 그래서 랜덤이 아니라 이름 해시를 쓴다.
 * 나중에 사용자가 직접 고르는 기능이 생기면 이 함수는 기본값 제공자로 남는다.
 */

const TILE_COUNT = 8;

/** 문자열 → 안정적인 양수 해시 (djb2). */
function hash(seed: string): number {
  let value = 5381;
  for (let index = 0; index < seed.length; index += 1) {
    value = ((value << 5) + value + seed.charCodeAt(index)) >>> 0;
  }
  return value;
}

export type TileTone = { bg: string; ink: string };

/**
 * seed → 파스텔 배경 + 그 위에 얹을 글자색.
 *
 * **숫자를 주면 그 값을 그대로 팔레트 인덱스로 쓴다.** 기준정보 id 처럼 연속된 값을 넘기면
 * 한 목록 안의 항목들이 서로 다른 색을 받는다 — 이름 해시는 짧은 목록에서 잘 겹쳐서
 * ("담임목사"·"목사"·"팀장"이 모두 같은 색) 구분하려고 색을 쓰는 의미가 없어진다.
 * 문자열은 id 가 없는 대상(사람 이름 등)용 대비책이다.
 */
export function tileTone(seed: string | number): TileTone {
  const bucket = typeof seed === 'number' ? Math.abs(Math.trunc(seed)) : hash(seed);
  const index = (bucket % TILE_COUNT) + 1;
  return {
    bg: `var(--color-tile-${index})`,
    ink: `var(--color-tile-${index}-ink)`,
  };
}

/** 도메인별 이모지 후보. 뜻이 통하는 것만 골라 담았다. */
const EMOJI_SETS = {
  training: ['📖', '✝️', '🔥', '🌱', '🙏', '⛺', '📕', '🕊️'],
  missionary: ['🌏', '✈️', '🌍', '🗺️', '🌎', '🏔️', '🏝️', '🚩'],
  event: ['📸', '🎉', '🏕️', '🎪', '🎁', '🎈', '🍰', '🎄'],
  calendar: ['📅', '⏰', '🔔', '📌', '🗓️', '⭐', '🎯', '📍'],
  member: ['🙂', '😊', '🌿', '☀️', '🌻', '🍀', '🌙', '🫶'],
  generic: ['📋', '📎', '🗂️', '📁', '🧾', '🗃️', '📌', '🏷️'],
} as const;

export type EmojiKind = keyof typeof EMOJI_SETS;

/** 이름 → 이모지. 같은 이름이면 늘 같은 이모지가 나온다. */
export function emojiFor(seed: string, kind: EmojiKind = 'generic'): string {
  const set = EMOJI_SETS[kind];
  return set[hash(seed) % set.length];
}
