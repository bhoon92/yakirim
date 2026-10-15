import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * flex 의 페이지 제목은 28px / 700 / 자간 -0.04em 하나뿐이다.
 * 30px 이상은 쓰지 않고, 설명문도 12px 로 눌러 본문이 위로 붙게 한다.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="space-y-1">
        {eyebrow && <p className="text-xs font-semibold text-[var(--color-muted-foreground)]">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tighter sm:text-3xl">{title}</h1>
        {description && <p className="text-xs text-[var(--color-muted-foreground)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
