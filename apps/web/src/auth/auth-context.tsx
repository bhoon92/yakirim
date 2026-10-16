import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export type AuthAccount = {
  id: number;
  email: string;
  name: string;
  pictureUrl?: string | null;
};

export type Membership = {
  id: number;
  accountId: number;
  churchId: number;
  role: 'owner' | 'admin' | 'staff' | 'shepherd' | 'viewer';
  churchName: string | null;
};

export type CurrentChurch = {
  id: number;
  name: string;
  /** 조직 대분류의 교회별 표시 이름. null 이면 코드 기본값(기관/사역팀/공동체). */
  departmentLabel?: string | null;
  ministryLabel?: string | null;
  smallGroupLabel?: string | null;
  tableLabel?: string | null;
};

export type MeResponse = {
  account: AuthAccount;
  memberships: Membership[];
  currentChurch: CurrentChurch | null;
  role: Membership['role'] | null;
  /** 이 교회에서 이 계정이 명부의 누구인지 (팀 화면에서 연결). residentId 가 있으면 간사. */
  self: { memberId: number; memberName: string; residentId: number | null } | null;
};

/**
 * `offline` 은 "로그아웃"과 구분하려고 둔 상태다.
 * API 가 꺼져 있으면 Vite 프록시가 502 를 주는데, 그걸 인증 실패와 같이 취급하면
 * 화면에는 그냥 로그인 페이지가 떠서 "로그인이 안 된다"로 보인다. 원인이 다르면 다르게 말해야 한다.
 */
type AuthState =
  | { status: 'loading' }
  | { status: 'offline'; message: string }
  | { status: 'unauthenticated' }
  | ({ status: 'authenticated' } & MeResponse);

type AuthContextValue = {
  state: AuthState;
  loginWithGoogle: () => void;
  devLogin: (email: string, name?: string) => Promise<void>;
  selectChurch: (churchId: number) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** API 자체에 닿지 못한 경우. 인증 실패(401)와 구분하려고 별도 타입으로 둔다. */
class ApiOfflineError extends Error {}

async function fetchMe(): Promise<MeResponse | null> {
  let res: Response;
  try {
    res = await fetch('/api/auth/me', { credentials: 'include' });
  } catch {
    // fetch 가 던지는 건 네트워크 단계 실패 — 개발 중에는 보통 Vite 는 떠 있고 API 만 꺼진 경우다.
    throw new ApiOfflineError('API 서버에 연결할 수 없습니다.');
  }
  if (res.status === 401) return null;
  // Vite 프록시는 백엔드가 죽어 있으면 502(연결 거부) / 504(응답 없음)를 돌려준다.
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new ApiOfflineError('API 서버가 응답하지 않습니다.');
  }
  if (!res.ok) throw new Error(`auth/me ${res.status}`);
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<AuthState | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    staleTime: 60_000,
    retry: false,
    // 서버가 꺼져 있는 동안만 짧게 다시 물어본다 → 사용자가 API 를 켜면 새로고침 없이 저절로 복구된다.
    refetchInterval: query => (query.state.error instanceof ApiOfflineError ? 3000 : false),
  });

  const state: AuthState = useMemo(() => {
    if (optimistic) return optimistic;
    if (isPending) return { status: 'loading' };
    if (error instanceof ApiOfflineError) return { status: 'offline', message: error.message };
    if (!data) return { status: 'unauthenticated' };
    return { status: 'authenticated', ...data };
  }, [optimistic, isPending, data, error]);

  const loginWithGoogle = useCallback(() => {
    window.location.href = '/api/auth/google';
  }, []);

  const devLogin = useCallback(
    async (email: string, name?: string) => {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, name }),
      });
      if (!res.ok) throw new Error('dev-login failed');
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      setOptimistic(null);
    },
    [queryClient]
  );

  const selectChurch = useCallback(
    async (churchId: number) => {
      const res = await fetch('/api/auth/select-church', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ churchId }),
      });
      if (!res.ok) throw new Error('select-church failed');
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setOptimistic({ status: 'unauthenticated' });
    await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    setOptimistic(null);
  }, [queryClient]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, loginWithGoogle, devLogin, selectChurch, logout, refresh }),
    [state, loginWithGoogle, devLogin, selectChurch, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
