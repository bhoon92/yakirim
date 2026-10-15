import { motion } from 'motion/react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { useAuth } from '@/auth/auth-context';
import { ApiOffline } from '@/components/api-offline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function OnboardingPage() {
  const navigate = useNavigate();
  const { state, refresh, logout } = useAuth();
  const [name, setName] = useState('');
  const [representative, setRepresentative] = useState('');
  const [fiscalMonth, setFiscalMonth] = useState(1);
  const [submitting, setSubmitting] = useState(false);
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

  if (state.currentChurch) {
    return <Navigate to="/app" replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/churches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          representative: representative || undefined,
          fiscalYearStartMonth: fiscalMonth,
        }),
      });
      if (!res.ok) {
        throw new Error(`교회 생성 실패 (${res.status})`);
      }
      await refresh();
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setSubmitting(false);
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
          <p className="text-xs font-medium tracking-wide text-[var(--color-muted-foreground)]">환영합니다 · {state.account.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">교회 만들기</h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">교회 정보를 입력하면 운영을 시작할 수 있어요.</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
          <Field label="교회명" required>
            <Input placeholder="예: 우리 교회" value={name} onChange={event => setName(event.target.value)} required maxLength={80} />
          </Field>

          <Field label="담임 / 대표자" hint="선택">
            <Input
              placeholder="예: 김 목사"
              value={representative}
              onChange={event => setRepresentative(event.target.value)}
              maxLength={60}
            />
          </Field>

          <Field label="회계연도 시작월" hint="기본 1월">
            <Input type="number" min={1} max={12} value={fiscalMonth} onChange={event => setFiscalMonth(Number(event.target.value))} />
          </Field>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={submitting || !name}>
            {submitting ? '만드는 중…' : '교회 만들고 시작하기'}
          </Button>
        </form>

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

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">
          {label}
          {required && <span className="ml-0.5 text-[var(--color-destructive)]">*</span>}
        </span>
        {hint && <span className="text-xs text-[var(--color-muted-foreground)]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
