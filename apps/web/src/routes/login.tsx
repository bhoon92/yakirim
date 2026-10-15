import { motion } from 'motion/react';
import { useState } from 'react';
import { Navigate } from 'react-router';

import { useAuth } from '@/auth/auth-context';
import { ApiOffline } from '@/components/api-offline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const IS_DEV = import.meta.env.DEV;

export function LoginPage() {
  const { state, loginWithGoogle, devLogin } = useAuth();
  const [devEmail, setDevEmail] = useState('');
  const [devName, setDevName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 로그인 화면에서도 원인을 구분해 준다 — Google 버튼을 눌러도 /api 가 죽어 있으면 아무 일도 안 일어난다.
  if (state.status === 'offline') {
    return <ApiOffline message={state.message} />;
  }

  if (state.status === 'authenticated') {
    return <Navigate to={state.currentChurch ? '/app' : '/onboarding'} replace />;
  }

  const handleDevSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!devEmail) return;
    setSubmitting(true);
    try {
      await devLogin(devEmail, devName || undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-[var(--color-muted)] px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <Wordmark />
          <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">교회를 위한 부드러운 관리 도구</p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
          <div className="space-y-1.5 pb-5 text-center">
            <h2 className="text-lg font-semibold tracking-tight">로그인</h2>
            <p className="text-xs text-[var(--color-muted-foreground)]">Google 계정으로 간편하게 시작하세요.</p>
          </div>

          <Button size="lg" variant="outline" className="w-full" onClick={loginWithGoogle}>
            <GoogleIcon />
            Google로 계속하기
          </Button>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
            계속 진행하면 서비스 이용약관과
            <br />
            개인정보 처리방침에 동의하는 것으로 간주됩니다.
          </p>
        </div>

        {IS_DEV && (
          <details className="mt-6 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-background)] p-4 text-xs text-[var(--color-muted-foreground)]">
            <summary className="cursor-pointer font-medium text-[var(--color-foreground)]">개발용 로그인 (localdev 전용)</summary>
            <form onSubmit={handleDevSubmit} className="mt-4 space-y-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={devEmail}
                onChange={event => setDevEmail(event.target.value)}
                required
              />
              <Input placeholder="이름 (선택)" value={devName} onChange={event => setDevName(event.target.value)} />
              <Button type="submit" size="sm" className="w-full" disabled={submitting || !devEmail}>
                {submitting ? '로그인 중…' : '개발 로그인'}
              </Button>
            </form>
          </details>
        )}
      </motion.div>
    </main>
  );
}

function Wordmark() {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="inline-block size-1.5 rounded-full bg-[var(--color-primary)]" />
      <span className="text-xl font-semibold tracking-tight">Yakirim</span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.48 12c0-.73.13-1.44.36-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
