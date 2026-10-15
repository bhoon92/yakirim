import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * flex 버튼 규격 (실제 배포 CSS 에서 확인한 값)
 *   높이  small 32 / default 40 / large 48   (--sizes-*)
 *   모서리 6px                                 (실사용 최빈값)
 *   굵기  600, 글자 13~14px
 *   채움  주요 행동은 primary 초록 #09bb1b
 *   보조  흰 배경 + inset ring 그림자 (테두리 대신) — --shadows-button
 *   포커스 검정 offset ring 이 아니라 초록
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-[background-color,box-shadow,opacity] duration-150 ease-out outline-none focus-visible:shadow-[0_0_0_2px_var(--color-background),0_0_0_4px_color-mix(in_srgb,var(--color-brand)_45%,transparent)] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-brand)] text-[var(--color-brand-foreground)] hover:bg-[var(--color-brand-hover)] active:bg-[var(--color-brand-active)]',
        /** 잉크색 채움 — 초록 CTA 와 나란히 둘 수 없을 때의 강조 */
        contrast: 'bg-[var(--color-foreground)] text-[var(--color-background)] hover:bg-[#3e4449] active:bg-[#2d3338]',
        /** flex 의 기본 보조 버튼 — 흰 배경 + inset ring */
        outline: 'bg-[var(--color-background)] text-[var(--color-foreground)] shadow-[var(--shadow-button)] hover:bg-[var(--color-muted)]',
        secondary: 'bg-[var(--color-muted)] text-[var(--color-secondary-foreground)] hover:bg-[var(--color-accent)]',
        ghost: 'text-[var(--color-secondary-foreground)] hover:bg-[var(--color-muted)]',
        destructive: 'bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] hover:bg-[#c32700] active:bg-[#661400]',
      },
      size: {
        xs: 'h-6 gap-1 px-2 text-xs',
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

// eslint-disable-next-line react-refresh/only-export-components
export { buttonVariants };
