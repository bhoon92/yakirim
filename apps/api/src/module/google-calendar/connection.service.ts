import { Injectable } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { GoogleCalendarConnectionEntity } from '@src/database/entities/google-calendar-connection.entity';
import { GoogleCalendarEventLinkEntity } from '@src/database/entities/google-calendar-event-link.entity';
import { GoogleOauthService, GoogleTokenSet } from './google-oauth.service';

/** access token 만료 60초 전이면 갱신. */
const REFRESH_SKEW_MS = 60_000;

@Injectable()
export class GoogleCalendarConnectionService {
  constructor(private readonly oauth: GoogleOauthService) {}

  private repo() {
    return DataSources.instance.getRepository(GoogleCalendarConnectionEntity);
  }

  private linkRepo() {
    return DataSources.instance.getRepository(GoogleCalendarEventLinkEntity);
  }

  forAccount(accountId: number, churchId: number): Promise<GoogleCalendarConnectionEntity | null> {
    return this.repo().findOne({ where: { accountId, churchId } });
  }

  activeForChurch(churchId: number): Promise<GoogleCalendarConnectionEntity[]> {
    return this.repo().find({ where: { churchId, isActive: true } });
  }

  /** 연결 저장 (재연결 시 기존 행 갱신). targetCalendarId/refreshToken 갱신. */
  async upsert(
    accountId: number,
    churchId: number,
    googleEmail: string,
    targetCalendarId: string,
    token: GoogleTokenSet
  ): Promise<GoogleCalendarConnectionEntity> {
    const existing = await this.forAccount(accountId, churchId);
    const row =
      existing ?? this.repo().create({ accountId, churchId, calendarId: [] as number[], googleEmail, targetCalendarId, refreshToken: '' });

    row.googleEmail = googleEmail;
    row.targetCalendarId = targetCalendarId;
    if (token.refreshToken) row.refreshToken = token.refreshToken;
    row.accessToken = token.accessToken;
    row.accessTokenExpiresAt = new Date(Date.now() + token.expiresInSec * 1000);
    row.isActive = true;
    return this.repo().save(row);
  }

  /** 캐시된 access token 이 유효하면 그대로, 아니면 refresh 후 저장. */
  async validAccessToken(connection: GoogleCalendarConnectionEntity): Promise<string> {
    const notExpired =
      connection.accessToken && connection.accessTokenExpiresAt && connection.accessTokenExpiresAt.getTime() - REFRESH_SKEW_MS > Date.now();
    if (notExpired) return connection.accessToken!;

    const refreshed = await this.oauth.refreshAccessToken(connection.refreshToken);
    connection.accessToken = refreshed.accessToken;
    connection.accessTokenExpiresAt = new Date(Date.now() + refreshed.expiresInSec * 1000);
    await this.repo().save(connection);
    return refreshed.accessToken;
  }

  /** 연결 + 이벤트 링크 제거. */
  async remove(connection: GoogleCalendarConnectionEntity): Promise<void> {
    await this.linkRepo().delete({ connectionId: connection.id });
    await this.repo().delete({ id: connection.id });
  }
}
