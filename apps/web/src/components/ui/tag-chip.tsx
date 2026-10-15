import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { tileTone } from '@/lib/tile';

/**
 * 이름으로 색이 정해지는 태그 — 노션의 다중 선택 옵션처럼 항목을 색으로 구분한다.
 *
 * 색은 `tileTone()`(팔레트 8색)에서 뽑으므로 DB 컬럼이 필요 없다.
 * `seed` 로 **기준정보 id** 를 넘기는 게 기본이다 — id 는 연속이라 한 목록 안에서 색이 겹치지 않고,
 * 값이 바뀌지 않으니 어느 화면에서 보든 같은 항목은 같은 색이다.
 * 나중에 사용자가 색을 직접 고르게 되면 이 함수가 기본값 제공자로 남는다.
 *
 * 목록이 회색 알약만 늘어서 있으면 이름을 하나하나 읽어야 하는데, 색이 붙으면
 * 위치와 색으로 먼저 찾게 된다 — 고를 항목이 열 개 넘어갈 때 특히 차이가 난다.
 */
export function TagChip({
  name,
  seed,
  prefix,
  suffix,
  muted,
  className,
  ...props
}: Omit<ComponentProps<'span'>, 'prefix'> & {
  name: string;
  /** 색을 정하는 값. 기준정보 id 처럼 연속된 숫자를 주면 목록 안에서 색이 겹치지 않는다. */
  seed?: string | number;
  /** 이름 앞에 붙일 것 (예: "+", 리더 별표) */
  prefix?: ReactNode;
  /** 이름 뒤에 붙일 것 (예: 삭제 버튼) */
  suffix?: ReactNode;
  /** 색을 빼고 회색으로 — 비활성·종료된 항목 */
  muted?: boolean;
}) {
  const tone = tileTone(seed ?? name);
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', className)}
      style={
        muted
          ? { backgroundColor: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }
          : { backgroundColor: tone.bg, color: tone.ink }
      }
      {...props}
    >
      {prefix}
      {name}
      {suffix}
    </span>
  );
}

/** 눌러서 고르는 태그. 선택 목록에서 쓴다. */
export function TagChipButton({
  name,
  seed,
  prefix,
  disabled,
  onClick,
  title,
  className,
}: {
  name: string;
  seed?: string | number;
  prefix?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  /** 선택 표시(ring) 등 호출부에서 얹는 것 */
  className?: string;
}) {
  const tone = tileTone(seed ?? name);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-[filter,opacity] hover:brightness-95 disabled:opacity-50',
        className
      )}
      style={{ backgroundColor: tone.bg, color: tone.ink }}
    >
      {prefix}
      {name}
    </button>
  );
}
