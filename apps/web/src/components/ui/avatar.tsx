import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { tileTone } from '@/lib/tile';

const SIZE = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-base',
  xl: 'size-20 text-xl',
} as const;

export type AvatarSize = keyof typeof SIZE;

/**
 * 사람 아바타 — flex 처럼 목록 어디에나 얼굴이 보이게 하는 게 목적.
 * 사진이 있으면 사진, 없으면 이름 기반 파스텔 + 이니셜(결정론적이라 같은 사람은 항상 같은 색).
 * 모서리는 원이 아니라 squircle 계열 — flex 의 프로필 사진 모양.
 */
export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const tone = tileTone(name);

  if (src) {
    return <img src={src} alt={name} className={cn('shrink-0 rounded-[35%] object-cover', SIZE[size], className)} loading="lazy" />;
  }

  return (
    <span
      aria-hidden
      title={name}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-[35%] font-semibold', SIZE[size], className)}
      style={{ backgroundColor: tone.bg, color: tone.ink }}
    >
      {initialOf(name)}
    </span>
  );
}

/** 여러 명을 겹쳐 보여주는 스택 — flex "인정과 피드백" 카드 패턴. */
export function AvatarStack({
  people,
  max = 4,
  size = 'xs',
}: {
  people: { name: string; src?: string | null }[];
  max?: number;
  size?: AvatarSize;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <div className="flex items-center">
      {shown.map((person, index) => (
        <div key={`${person.name}-${index}`} className={index === 0 ? '' : '-ml-2'}>
          <Avatar name={person.name} src={person.src} size={size} className="ring-2 ring-[var(--color-background)]" />
        </div>
      ))}
      {rest > 0 && (
        <span className="-ml-2 inline-flex size-6 items-center justify-center rounded-[35%] bg-[var(--color-muted)] text-[10px] font-semibold text-[var(--color-muted-foreground)] ring-2 ring-[var(--color-background)]">
          +{rest}
        </span>
      )}
    </div>
  );
}

/** 한글은 마지막 두 글자(예: 박병훈 → 병훈), 영문은 첫 글자. */
function initialOf(name: string): ReactNode {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  if (/[가-힣]/.test(trimmed)) return trimmed.length >= 2 ? trimmed.slice(-2) : trimmed;
  return trimmed[0].toUpperCase();
}
