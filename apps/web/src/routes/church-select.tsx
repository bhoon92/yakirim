import { motion } from 'motion/react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { useAuth } from '@/auth/auth-context';
import { ApiOffline } from '@/components/api-offline';
import { cn } from '@/lib/utils';

const ROLE_LABEL: Record<string, string> = {
  owner: '소유자',
  admin: '관리자',
  staff: '실무자',
  viewer: '조회',
};

export function ChurchSelectPage() {
  const navigate = useNavigate();
  const { state, selectChurch, logout } = useAuth();
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (state.status === 'loading') {
    return <div className="flex min-h-svh items-center justify-center text-sm text-[var(--color-muted-foreground)]">불러오는 중…</div>;
  }

  if (state.status === 'offline') {
    return <ApiOffline message={state.message} />;
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  // 소속 교회 없음 → 온보딩 / 이미 활성 교회 있음 → 앱
  if (state.memberships.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }
  if (state.currentChurch) {
    return <Navigate to="/app" replace />;
  }

  const choose = async (churchId: number) => {
    setError(null);
    setPending(churchId);
    try {
      await selectChurch(churchId);
      navigate('/app', { replace: true });
    } catch {
      setError('교회 선택에 실패했습니다.');
      setPending(null);
    }
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-[var(--color-muted)] px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <p className="text-xs font-medium tracking-wide text-[var(--color-muted-foreground)]">{state.account.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">교회 선택</h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">여러 교회에 소속되어 있어요. 들어갈 교회를 선택하세요.</p>
        </div>

        <ul className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-sm">
          {state.memberships.map(membership => (
            <li key={membership.id}>
              <button
                onClick={() => choose(membership.churchId)}
                disabled={pending !== null}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border border-transparent px-4 py-3 text-left transition-colors',
                  'hover:border-[var(--color-border)] hover:bg-[var(--color-muted)] disabled:opacity-50'
                )}
              >
                <span className="text-sm font-medium">{membership.churchName ?? `교회 #${membership.churchId}`}</span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {pending === membership.churchId ? '들어가는 중…' : (ROLE_LABEL[membership.role] ?? membership.role)}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => void logout()}
            className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            다른 계정으로 로그인
          </button>
        </div>
      </motion.div>
    </main>
  );
}
