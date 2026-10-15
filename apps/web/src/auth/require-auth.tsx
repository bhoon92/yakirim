import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '@/auth/auth-context';
import { ApiOffline } from '@/components/api-offline';

export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') {
    return <div className="flex min-h-svh items-center justify-center text-sm text-[var(--color-muted-foreground)]">불러오는 중…</div>;
  }

  // 서버가 꺼진 것을 로그아웃으로 오해해 로그인 페이지로 보내지 않는다.
  if (state.status === 'offline') {
    return <ApiOffline message={state.message} />;
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 로그인됐는데 활성 교회 없음 → 소속 교회가 있으면 선택, 없으면 온보딩
  if (!state.currentChurch) {
    return <Navigate to={state.memberships.length > 0 ? '/church-select' : '/onboarding'} replace />;
  }

  return <Outlet />;
}
