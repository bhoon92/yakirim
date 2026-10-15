import { Controller, Delete, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { ConfigProvider } from '@src/config';
import { DataSources } from '@src/database/data-sources';
import { ChurchEntity } from '@src/database/entities/church.entity';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { GoogleCalendarClient } from './google-calendar.client';
import { GoogleCalendarConnectionService } from './connection.service';
import { GoogleCalendarSyncService } from './sync.service';
import { GoogleOauthService } from './google-oauth.service';

type Auth = AuthContext & { churchId: number };
type StatePayload = { accountId: number; churchId: number; purpose: 'gcal' };

@ApiTags(SwaggerTag.GOOGLE_CALENDAR)
@Controller('google-calendar')
export class GoogleCalendarController {
  constructor(
    private readonly oauth: GoogleOauthService,
    private readonly client: GoogleCalendarClient,
    private readonly connections: GoogleCalendarConnectionService,
    private readonly sync: GoogleCalendarSyncService,
    private readonly jwt: JwtService
  ) {}

  /** 연동 상태. */
  @Get('status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('calendar:read')
  @ApiAuth()
  @ApiOperation({
    summary: '연동 상태 확인',
    description:
      '연동 전이면 `{ connected: false }`, 연동 후에는 연결된 구글 계정 이메일과 전용 캘린더 id 가 함께 온다. 연동은 **계정별**이다.',
  })
  async status(@RequireChurch() auth: Auth) {
    const connection = await this.connections.forAccount(auth.accountId, auth.churchId);
    if (!connection) return { connected: false };
    return {
      connected: true,
      googleEmail: connection.googleEmail,
      targetCalendarId: connection.targetCalendarId,
      calendarId: connection.calendarId,
    };
  }

  /** 동의 화면 URL 발급 (프론트가 top-level 이동). state 에 account/church 서명. */
  @Get('connect')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('calendar:write')
  @ApiAuth()
  @ApiOperation({
    summary: '[1단계] 구글 동의 URL 발급',
    description: [
      '동의 화면 URL 만 만들어 반환한다(리다이렉트하지 않음). 프론트가 이 URL 로 **top-level 이동**해야 한다.',
      '',
      '`state` 에는 accountId·churchId 를 담아 10분 만료로 서명하므로, 콜백은 별도 쿠키 없이 누가 연동 중인지 알 수 있다.',
    ].join('\n'),
  })
  @ApiOkResponse({ schema: { type: 'object', properties: { url: { type: 'string', description: '구글 동의 화면 URL' } } } })
  connect(@RequireChurch() auth: Auth) {
    const state = this.jwt.sign({ accountId: auth.accountId, churchId: auth.churchId, purpose: 'gcal' } satisfies StatePayload, {
      expiresIn: '10m',
    });
    return { url: this.oauth.buildConsentUrl(state) };
  }

  /** Google redirect 콜백 — 가드 없음(state 서명으로 인증). 토큰 교환 → 전용 캘린더 생성 → 연결 저장. */
  @Get('callback')
  @ApiOperation({
    summary: '[2단계] 구글 콜백 (직접 호출 금지)',
    description: [
      '구글이 호출하는 주소. **가드가 없고** `state` 서명 검증으로 신원을 확인한다.',
      '',
      '처리: code → 토큰 교환 → 사용자 이메일 조회 → "{교회명} 일정" 전용 캘린더 생성 → 연결 저장.',
      'refresh token 을 못 받으면(push 불가) 실패로 처리한다. 성공/실패 모두 웹으로 리다이렉트되며',
      '`/app/calendar?gcal=connected` 또는 `?gcal=error` 로 결과가 전달된다.',
    ].join('\n'),
  })
  @ApiQuery({ name: 'code', description: '구글이 발급한 authorization code', required: true })
  @ApiQuery({ name: 'state', description: 'connect 단계에서 서명한 state JWT', required: true })
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const back = (status: string) => res.redirect(`${ConfigProvider.web.baseUrl}/app/calendar?gcal=${status}`);
    let payload: StatePayload;
    try {
      payload = this.jwt.verify<StatePayload>(state);
      if (payload.purpose !== 'gcal') throw new Error('bad purpose');
    } catch {
      return back('error');
    }
    if (!code) return back('error');

    try {
      const token = await this.oauth.exchangeCode(code);
      if (!token.refreshToken) return back('error'); // refresh token 없으면 push 불가
      const email = await this.oauth.userEmail(token.accessToken);
      const church = await DataSources.instance.getRepository(ChurchEntity).findOne({ where: { id: payload.churchId } });
      const calendarId = await this.client.createCalendar(token.accessToken, `${church?.name ?? '교회'} 일정`);
      await this.connections.upsert(payload.accountId, payload.churchId, email, calendarId, token);
      return back('connected');
    } catch {
      return back('error');
    }
  }

  /** 연동 해제 — 전용 구글 캘린더 삭제(best-effort) + 연결/링크 제거. */
  @Delete()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('calendar:write')
  @ApiAuth()
  @ApiOperation({
    summary: '연동 해제',
    description: [
      '구글 쪽 전용 캘린더 삭제를 시도한 뒤(실패해도 무시) 로컬 연결과 이벤트 링크를 제거한다.',
      '연동이 없어도 `{ ok: true }` 를 반환한다(멱등).',
    ].join('\n'),
  })
  @ApiOkResponse({ schema: { type: 'object', properties: { ok: { type: 'boolean', example: true } } } })
  async disconnect(@RequireChurch() auth: Auth) {
    const connection = await this.connections.forAccount(auth.accountId, auth.churchId);
    if (!connection) return { ok: true };
    try {
      const token = await this.connections.validAccessToken(connection);
      await this.client.deleteCalendar(token, connection.targetCalendarId);
    } catch {
      // 구글 쪽 정리는 best-effort — 로컬 연결은 무조건 제거.
    }
    await this.connections.remove(connection);
    return { ok: true };
  }

  /** 기존 미래 일정 일괄 push. */
  @Post('sync')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('calendar:write')
  @ApiAuth()
  @ApiOperation({
    summary: '기존 일정 일괄 push (backfill)',
    description: [
      '연동 시점 이후의 변경은 자동 push 되지만, **연동 전에 만들어둔 미래 일정은 이 호출로** 한 번 밀어넣는다.',
      '연동이 없으면 `{ pushed: 0 }`.',
    ].join('\n'),
  })
  @ApiOkResponse({ schema: { type: 'object', properties: { pushed: { type: 'number', description: 'push 된 일정 수' } } } })
  async backfill(@RequireChurch() auth: Auth) {
    const connection = await this.connections.forAccount(auth.accountId, auth.churchId);
    if (!connection) return { pushed: 0 };
    return this.sync.backfill(connection);
  }
}
