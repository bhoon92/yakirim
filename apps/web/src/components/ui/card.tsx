import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * flex 카드 규격: 모서리 10px, 헤어라인 테두리, 그림자 없음.
 * 캔버스 위에 뜬 판은 셸의 본문 패널 하나뿐이고 그 안의 카드는 평평하다 —
 * 카드마다 그림자를 주면 화면이 금방 지저분해진다.
 */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-card-foreground)]', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('text-lg font-semibold tracking-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-[var(--color-muted-foreground)]', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center p-5 pt-0', className)} {...props} />;
}
