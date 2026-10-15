import { Navigate } from 'react-router';

import { useAuth } from '@/auth/auth-context';
import { ApiOffline } from '@/components/api-offline';

export function HomePage() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return <div className="flex min-h-svh items-center justify-center text-sm text-[var(--color-muted-foreground)]">불러오는 중…</div>;
  }

  if (state.status === 'offline') {
    return <ApiOffline message={state.message} />;
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (!state.currentChurch) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/app" replace />;
}
