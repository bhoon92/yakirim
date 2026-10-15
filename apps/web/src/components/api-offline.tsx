import { PlugZap, RefreshCw } from 'lucide-react';

/**
 * API 가 꺼져 있을 때 보여주는 화면.
 *
 * 이게 없으면 502 가 그냥 로그인 페이지로 떨어져서 "로그인이 안 된다"로만 보인다.
 * 원인(백엔드 미기동)과 해결책(명령 한 줄)을 직접 말해 주는 게 목적이다.
 * 인증 조회가 3초마다 다시 시도하므로 서버를 켜면 **새로고침 없이 저절로 사라진다**.
 */
export function ApiOffline({ message }: { message: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[var(--color-muted)] px-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#ffe4dc] text-[#c32700]">
            <PlugZap className="size-[18px]" />
          </span>
          <div>
            <h1 className="text-base font-semibold">{message}</h1>
            <p className="text-xs text-[var(--color-muted-foreground)]">로그인이 안 되는 게 아니라 서버가 꺼져 있는 상태입니다.</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">터미널에서 아래를 실행하면 다시 연결됩니다.</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--color-foreground)] px-3 py-2.5 text-xs text-[var(--color-background)]">
          pnpm dev:api
        </pre>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
          <RefreshCw className="size-3.5 animate-spin [animation-duration:3s]" />
          3초마다 다시 확인하고 있습니다 — 서버가 켜지면 이 화면은 저절로 사라집니다.
        </p>
      </div>
    </main>
  );
}
