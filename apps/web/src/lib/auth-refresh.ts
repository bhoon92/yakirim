/**
 * 전역 fetch 인터셉터: /api 요청이 401 이면 /api/auth/refresh 로 access 토큰을 갱신하고
 * 원 요청을 1회 재시도. 동시 401 은 single-flight 로 한 번만 갱신.
 * access(2h) 만료 시 refresh(30d)로 자동 연장 → 2시간마다 강제 로그아웃 방지.
 */
let refreshPromise: Promise<boolean> | null = null;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input);
}

export function installAuthRefresh(): void {
  const originalFetch = window.fetch.bind(window);

  function refreshOnce(): Promise<boolean> {
    if (!refreshPromise) {
      refreshPromise = originalFetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
        .then(res => res.ok)
        .catch(() => false)
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  }

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init);
    const url = urlOf(input);

    const eligible =
      response.status === 401 && url.includes('/api/') && !url.includes('/api/auth/refresh') && !url.includes('/api/auth/dev-login');
    if (!eligible) return response;

    const refreshed = await refreshOnce();
    if (!refreshed) return response; // 갱신 실패 → 원래 401 그대로 (auth-context 가 로그인으로)

    // 재시도는 인터셉터를 거치지 않는 originalFetch 로 (무한루프 방지). 쿠키 포함.
    return originalFetch(input, { ...init, credentials: 'include' });
  };
}
