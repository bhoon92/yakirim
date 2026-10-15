import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigProvider } from '@src/config';

/**
 * Google OAuth 2.0 — 캘린더 push 연동 전용 플로우 (로그인 OAuth 와 별개).
 * 로그인은 scope email/profile 만 받지만, 여기선 calendar scope + offline access 로 refresh token 확보.
 * 의존성 추가 없이 raw fetch 로 토큰 엔드포인트 호출.
 */
export const GOOGLE_CALENDAR_SCOPE = ['https://www.googleapis.com/auth/calendar', 'email'].join(' ');

export type GoogleTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresInSec: number;
};

@Injectable()
export class GoogleOauthService {
  /** 캘린더 연동 콜백 — 로그인 콜백과 다른 경로. GCP redirect URI 등록 필요. */
  redirectUri(): string {
    return `${ConfigProvider.web.baseUrl}/api/google-calendar/callback`;
  }

  /** 동의 화면 URL. prompt=consent 로 매 연결마다 refresh token 재발급 보장. */
  buildConsentUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: ConfigProvider.auth.google.clientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: GOOGLE_CALENDAR_SCOPE,
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /** authorization code → 토큰. refresh token 은 최초 동의 시에만 내려옴. */
  async exchangeCode(code: string): Promise<GoogleTokenSet> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: ConfigProvider.auth.google.clientId,
        client_secret: ConfigProvider.auth.google.clientSecret,
        redirect_uri: this.redirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new InternalServerErrorException(`Google token exchange 실패: ${res.status} ${JSON.stringify(json)}`);
    }
    return {
      accessToken: String(json.access_token),
      refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
      expiresInSec: Number(json.expires_in ?? 3600),
    };
  }

  /** refresh token 으로 access token 재발급 (push 시점). */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresInSec: number }> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: ConfigProvider.auth.google.clientId,
        client_secret: ConfigProvider.auth.google.clientSecret,
        grant_type: 'refresh_token',
      }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new InternalServerErrorException(`Google token refresh 실패: ${res.status} ${JSON.stringify(json)}`);
    }
    return { accessToken: String(json.access_token), expiresInSec: Number(json.expires_in ?? 3600) };
  }

  /** 연결한 구글 계정 이메일 조회. */
  async userEmail(accessToken: string): Promise<string> {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || typeof json.email !== 'string') {
      throw new InternalServerErrorException(`Google userinfo 실패: ${res.status}`);
    }
    return json.email;
  }
}
