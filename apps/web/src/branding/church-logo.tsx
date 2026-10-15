import { useChurchBranding } from '@/branding/church-branding';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<Size, string> = {
  sm: 'size-8 text-sm',
  md: 'size-10 text-base',
  lg: 'size-14 text-xl',
};

export function ChurchLogo({ size = 'md', className }: { size?: Size; className?: string }) {
  const branding = useChurchBranding();

  if (branding.logoUrl) {
    return <img src={branding.logoUrl} alt={branding.name} className={cn('rounded-full object-cover', SIZE_MAP[size], className)} />;
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight select-none',
        SIZE_MAP[size],
        className
      )}
      style={{
        backgroundColor: 'var(--color-church-accent)',
        color: 'var(--color-church-accent-foreground)',
      }}
      aria-label={branding.name}
    >
      {branding.shortName.slice(0, 2)}
    </div>
  );
}
