import { Body, Controller, ForbiddenException, Get, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { ConfigProvider } from '@src/config';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth.constants';
import { AuthService, SessionResult } from './auth.service';
import { CurrentAuth } from './decorators/current-auth.decorator';
import { SelectChurchDto } from './dto/select-church.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { GoogleProfile } from './strategies/google.strategy';
import type { AuthContext } from './types/auth-context';

@ApiTags(SwaggerTag.AUTH)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: '[1단계] 구글 로그인 시작',
    description:
      'Passport 가 구글 동의 화면으로 **302 리다이렉트** 시킨다. 브라우저 주소창으로 접근해야 하며 Swagger 의 Try it out 으로는 확인할 수 없다.',
  })
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  googleAuth() {
    // Passport 가 Google 로 리다이렉트 — 빈 메서드 OK
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: '[2단계] 구글 콜백 (직접 호출 금지)',
    description: [
      '구글이 code 를 붙여 되돌려주는 주소. 여기서 계정을 upsert 하고 access/refresh 쿠키를 심은 뒤 웹으로 리다이렉트한다.',
      '',
      '리다이렉트 목적지: 소속 교회가 없으면 `/onboarding`, 활성 교회가 있으면 `/app`, 여러 교회면 `/church-select`.',
    ].join('\n'),
  })
  async googleCallback(@Req() req: Request & { user: GoogleProfile }, @Res() res: Response) {
    const session = await this.auth.upsertAndIssueSession(req.user);
    this.setSessionCookies(res, session.token, session.refreshToken);
    res.redirect(this.nextUrlFor(session));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({
    summary: '내 세션 정보',
    description: '로그인한 계정, 소속 교회 멤버십 목록(교회 이름 포함), 현재 활성 교회와 역할을 반환한다. 프론트 부팅 시 첫 호출.',
  })
  me(@CurrentAuth() auth: AuthContext) {
    return this.auth.me(auth);
  }

  @Post('logout')
  @ApiOperation({ summary: '로그아웃', description: 'access/refresh 쿠키를 삭제한다. 서버에 세션 저장소가 없어 쿠키 제거가 곧 로그아웃.' })
  @ApiNoContentResponse({ description: '쿠키 삭제 완료' })
  logout(@Res() res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
    res.status(204).end();
  }

  /** refresh 쿠키로 access·refresh 재발급(회전). JwtAuthGuard 없음(access 만료 시 호출). */
  @Post('refresh')
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiOperation({
    summary: '세션 갱신 (토큰 회전)',
    description: [
      `refresh 쿠키(\`${REFRESH_TOKEN_COOKIE}\`)만으로 access·refresh 를 **둘 다** 새로 발급한다.`,
      'access 가 만료된 상태에서 호출하므로 JwtAuthGuard 가 없다. 실패 시 두 쿠키를 모두 지우고 401 → 프론트는 로그인 화면으로.',
    ].join('\n'),
  })
  @ApiNoContentResponse({ description: '갱신 성공 (새 쿠키가 Set-Cookie 로 내려감)' })
  @ApiUnauthorizedResponse({ description: 'refresh 쿠키 없음 또는 검증 실패 (쿠키 전부 삭제됨)' })
  async refresh(@Req() req: Request, @Res() res: Response) {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException('refresh 토큰 없음');
    try {
      const tokens = await this.auth.refreshSession(token);
      this.setSessionCookies(res, tokens.accessToken, tokens.refreshToken);
      res.status(204).end();
    } catch {
      res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
      res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
      throw new UnauthorizedException('refresh 실패');
    }
  }

  @Post('select-church')
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({
    summary: '활성 교회 선택',
    description: [
      '이후 모든 도메인 API 가 사용할 churchId 를 정하고, 그 churchId·role 을 담아 JWT 를 재발급한다(쿠키 갱신).',
      '',
      '교회를 선택하지 않은 토큰으로 도메인 API 를 호출하면 403 이 난다. 소속되지 않은 교회를 지정하면 여기서 403.',
    ].join('\n'),
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { churchId: { type: 'number', example: 1 }, role: { type: 'string', example: 'owner' } },
    },
  })
  async selectChurch(@CurrentAuth() auth: AuthContext, @Body() body: SelectChurchDto, @Res() res: Response) {
    const result = await this.auth.selectChurch(auth.accountId, body.churchId);
    this.setSessionCookies(res, result.token, result.refreshToken);
    res.json({ churchId: body.churchId, role: result.role });
  }

  /** localdev 전용: Google 자격증명 없이 흐름을 검증 */
  @Post('dev-login')
  @ApiOperation({
    summary: '개발용 로그인 (localdev 전용)',
    description: [
      '구글 자격증명 없이 이메일만으로 계정을 만들고 세션 쿠키를 심는다. `stage !== localdev` 면 403.',
      '',
      '**Swagger 에서 다른 엔드포인트를 테스트하려면 여기서 먼저 로그인**하면 된다 (쿠키가 브라우저에 남아 그대로 인증됨).',
      '응답의 `next` 는 프론트가 이동해야 할 경로 힌트.',
    ].join('\n'),
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: { email: { type: 'string', example: 'dev@yakirim.local' }, name: { type: 'string', example: '개발자' } },
    },
  })
  async devLogin(@Body() body: { email: string; name?: string }, @Res() res: Response) {
    if (ConfigProvider.stage !== 'localdev') {
      throw new ForbiddenException('Dev login is disabled');
    }
    const profile: GoogleProfile = {
      googleId: `dev:${body.email}`,
      email: body.email,
      name: body.name ?? body.email.split('@')[0],
    };
    const session = await this.auth.upsertAndIssueSession(profile);
    this.setSessionCookies(res, session.token, session.refreshToken);
    res.json({
      account: { id: session.account.id, email: session.account.email, name: session.account.name },
      memberships: session.memberships,
      activeChurchId: session.activeChurchId,
      next: this.nextPathFor(session),
    });
  }

  private setSessionCookies(res: Response, accessToken: string, refreshToken: string) {
    // access 는 짧게(2h), refresh 는 길게(30d). access 만료 시 /auth/refresh 로 갱신.
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, this.cookieOptions(1000 * 60 * 60 * 2));
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, this.cookieOptions(1000 * 60 * 60 * 24 * 30));
  }

  private cookieOptions(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: ConfigProvider.cookie.isSecure,
      path: '/',
      maxAge,
    };
  }

  private nextPathFor(s: SessionResult): string {
    if (s.memberships.length === 0) return '/onboarding';
    if (s.activeChurchId) return '/app';
    return '/church-select';
  }

  private nextUrlFor(s: SessionResult): string {
    return `${ConfigProvider.web.baseUrl}${this.nextPathFor(s)}`;
  }
}
