import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * flex 태그 규격: 높이 24 / 좌우 9px / 글자 12px 600 / pill(--radii-tag 50px)
 * 배경만으로는 흰 카드 위에서 경계가 흐려서 flex 는 inset ring 을 한 겹 얹는다.
 * 색은 flex 팔레트의 Lightest~Lighter 사이 배경 + Dark 글자 조합.
 */
const badgeVariants = cva(
  'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap shadow-[var(--shadow-tag)]',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]',
        muted: 'bg-[#f8f9f9] text-[var(--color-muted-foreground)]',
        accent: 'bg-[#e4f7e7] text-[#058012]',
        success: 'bg-[#e4f7e7] text-[#058012]',
        warn: 'bg-[#f7ecd6] text-[#8a5700]',
        danger: 'bg-[#ffe4dc] text-[#c32700]',
        info: 'bg-[#e2effd] text-[#1545a1]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, className }))} {...props} />;
}
