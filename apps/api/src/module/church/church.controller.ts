import { Body, Controller, Get, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { ACCESS_TOKEN_COOKIE } from '@src/module/auth/auth.constants';
import { AuthService } from '@src/module/auth/auth.service';
import { CurrentAuth, RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { ConfigProvider } from '@src/config';
import { ChurchService } from './church.service';
import { CreateChurchDto } from './dto/create-church.dto';
import { UpdateOrganizationLabelsDto } from './dto/organization-labels.dto';

@ApiTags(SwaggerTag.CHURCH)
@ApiAuth()
@Controller('churches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChurchController {
  constructor(
    private readonly churches: ChurchService,
    private readonly auth: AuthService
  ) {}

  /** 온보딩 — 첫 교회를 만들고, JWT를 churchId 포함으로 재발급 */
  @Post()
  @ApiOperation({
    summary: '교회 생성 (온보딩)',
    description: [
      '교회를 만들고 만든 계정에 **owner 멤버십**을 부여한 뒤, 그 교회를 활성 교회로 하는 JWT 를 재발급한다(쿠키 갱신).',
      '',
      '즉 이 호출 하나로 `POST /auth/select-church` 까지 끝난 상태가 되므로, 바로 다음 요청에서 도메인 API 를 쓸 수 있다.',
      '',
      '같은 트랜잭션에서 **기준정보 기본값이 시드된다**: 재적상태(양성 파이프라인 단계) · 사역 역할 · 사역팀 ·',
      '기관 · 공동체 · 예배 · 헌금항목 · 계정과목 · 훈련 과정 · 캘린더. 재적상태가 없으면 교인 등록이 불가능하므로 필수 단계다.',
    ].join('\n'),
  })
  @ApiCreatedResponse({ description: '생성된 교회와 멤버십' })
  async create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateChurchDto, @Res() res: Response) {
    const { church, membership } = await this.churches.create(auth.accountId, dto);
    const reissue = await this.auth.selectChurch(auth.accountId, church.id);

    res.cookie(ACCESS_TOKEN_COOKIE, reissue.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: ConfigProvider.cookie.isSecure,
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
    res.status(201).json({ church, membership });
  }

  @Get('me')
  @ApiOperation({ summary: '현재 활성 교회 조회', description: '토큰의 churchId 로 교회 정보를 반환한다. 교회 미선택 상태면 403.' })
  async me(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.churches.findById(auth.churchId);
  }

  @Patch('me/organization-labels')
  @Permissions('settings:write')
  @ApiOperation({
    summary: '조직 대분류 표시 이름 변경',
    description: [
      '조직 대분류를 이 교회에서 부르는 이름을 바꾼다 — 부서/구역/목장/셀처럼 교회마다 용어가 달라서다.',
      '',
      '**대분류의 개수·성격은 3종 고정이다**(기관 / 사역팀 / 공동체). 각각 소속 이력 테이블과 예산 배정',
      '대상이 따로 있어 개수를 바꾸려면 스키마를 바꿔야 한다. 여기서 바뀌는 건 표시 이름뿐이다.',
      '',
      '빈 문자열이나 null 을 보내면 기본값으로 되돌아가고, 보내지 않은 항목은 그대로 유지된다.',
      '변경된 이름은 `/auth/me` 의 `currentChurch` 로 내려가 앱 전체(조직도·교인 소속·예산 대상)에 반영된다.',
    ].join('\n'),
  })
  async updateOrganizationLabels(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: UpdateOrganizationLabelsDto) {
    return this.churches.updateOrganizationLabels(auth.churchId, dto);
  }
}
