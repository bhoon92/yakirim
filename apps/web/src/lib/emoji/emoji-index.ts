import type { EmojiEntry } from './search';

let loading: Promise<EmojiEntry[]> | null = null;

/**
 * 이모지 목록을 처음 쓸 때 한 번만 불러온다 (약 100KB gzip) — 앱 첫 화면에는 넣지 않는다.
 * 한국어 이름·태그는 emojibase ko, 영어 단축어는 github 식(":pray:" 의 pray).
 */
export function loadEmojiIndex(): Promise<EmojiEntry[]> {
  loading ??= Promise.all([import('emojibase-data/ko/compact.json'), import('emojibase-data/en/shortcodes/github.json')]).then(
    ([{ default: emojis }, { default: shortcodes }]) =>
      emojis
        // group 이 없는 것(국기 낱자)과 2(피부색 같은 조합용 부품)는 단독으로 쓰지 않는다
        .filter(emoji => emoji.group !== undefined && emoji.group !== 2)
        .map(emoji => {
          const codes = shortcodes[emoji.hexcode];
          return {
            emoji: emoji.unicode,
            label: emoji.label,
            keys: [...(emoji.tags ?? []), ...(Array.isArray(codes) ? codes : codes ? [codes] : [])],
          };
        })
  );
  return loading;
}
