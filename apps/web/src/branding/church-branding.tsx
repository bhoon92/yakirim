import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';

import { useAuth } from '@/auth/auth-context';

export type ChurchBranding = {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string;
  accent: string;
  accentForeground: string;
};

// 후속: per-church accent / logoUrl 을 DB 에 추가하면 그 값으로 교체
const DEFAULT_ACCENT = 'oklch(0.32 0.07 250)';
const DEFAULT_ACCENT_FG = 'oklch(0.98 0.01 90)';

const ChurchBrandingContext = createContext<ChurchBranding | null>(null);

export function ChurchBrandingProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth();

  const branding = useMemo<ChurchBranding | null>(() => {
    if (state.status !== 'authenticated' || !state.currentChurch) return null;
    const name = state.currentChurch.name;
    return {
      id: String(state.currentChurch.id),
      name,
      shortName: name.slice(0, 2),
      accent: DEFAULT_ACCENT,
      accentForeground: DEFAULT_ACCENT_FG,
    };
  }, [state]);

  const style = useMemo<CSSProperties>(
    () =>
      ({
        '--color-church-accent': branding?.accent ?? DEFAULT_ACCENT,
        '--color-church-accent-foreground': branding?.accentForeground ?? DEFAULT_ACCENT_FG,
      }) as CSSProperties,
    [branding]
  );

  return (
    <ChurchBrandingContext.Provider value={branding}>
      <div style={style} className="contents">
        {children}
      </div>
    </ChurchBrandingContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChurchBranding() {
  const ctx = useContext(ChurchBrandingContext);
  if (!ctx) throw new Error('useChurchBranding must be used inside <ChurchBrandingProvider> (and inside an authenticated route)');
  return ctx;
}
