import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * flex 입력 규격: 높이 40 / 모서리 6 / 테두리 대신 inset ring
 * 포커스는 초록 1px inset — 링이 바깥으로 번지지 않아 표 안에서도 줄이 안 밀린다.
 */
export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md bg-[var(--color-background)] px-3 text-base shadow-[var(--shadow-input)] outline-none',
        'placeholder:font-normal placeholder:text-[var(--color-muted-foreground)]',
        'transition-shadow duration-150 focus-visible:shadow-[var(--shadow-input-focus)]',
        '[&[aria-invalid="true"]]:shadow-[var(--shadow-input-error)]',
        'disabled:cursor-not-allowed disabled:bg-[var(--color-muted)] disabled:opacity-60',
        className
      )}
      {...props}
    />
  );
}
