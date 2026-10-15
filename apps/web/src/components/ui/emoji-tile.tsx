import { cn } from '@/lib/utils';
import { emojiFor, tileTone, type EmojiKind } from '@/lib/tile';

const SIZE = {
  sm: 'size-8 text-base',
  md: 'size-10 text-lg',
  lg: 'size-12 text-xl',
} as const;

/**
 * flex 문서함 목록의 그 타일 — 파스텔 배경 + 이모지 한 개.
 * 텍스트만 늘어선 목록을 훑을 때 눈이 걸릴 지점을 만들어 준다.
 *
 * `emoji` 를 직접 주지 않으면 `seed`(이름 등)에서 결정론적으로 고른다.
 */
export function EmojiTile({
  seed,
  kind = 'generic',
  emoji,
  size = 'md',
  className,
}: {
  seed: string;
  kind?: EmojiKind;
  emoji?: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const tone = tileTone(seed);
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-[30%] leading-none', SIZE[size], className)}
      style={{ backgroundColor: tone.bg }}
    >
      {emoji ?? emojiFor(seed, kind)}
    </span>
  );
}
