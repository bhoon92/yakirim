import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { CreateMemberDto } from './dto/create-member.dto';
import { ListMemberQueryDto } from './dto/list-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberService } from './member.service';
import { MemberStatusHistoryService } from './member-status-history.service';

@ApiTags(SwaggerTag.MEMBER)
@ApiAuth()
@Controller('members')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MemberController {
  constructor(
    private readonly members: MemberService,
    private readonly statusHistory: MemberStatusHistoryService
  ) {}

  @Get()
  @Permissions('member:read')
  @ApiOperation({
    summary: '교인 목록 (검색·페이징)',
    description: [
      '활성 교회의 교인을 최근 등록순으로 반환한다.',
      '',
      '- `q`: 이름·전화 부분 일치',
      '- `affiliationKind` + `affiliationId`: 특정 부서/사역팀/목장 소속만 (둘을 함께 보내야 함)',
      '- `statusId`: 재적상태 필터',
      '- `stalled=true`: 현재 단계에 기준 일수 이상 머물러 있는 교인만 (대시보드 "정체된 사람" 과 같은 기준)',
      '- 응답: `{ items, total, page, pageSize, counts }` — `counts` 는 재적상태별 인원 수(필터 배지용)',
    ].join('\n'),
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }, @Query() query: ListMemberQueryDto) {
    return this.members.list(auth.churchId, query);
  }

  // ':id' 보다 먼저 선언한다 — 정적 세그먼트가 먼저 잡히게.
  @Get('stalled')
  @Permissions('member:read')
  @ApiOperation({
    summary: '정체된 교인',
    description: [
      '현재 재적상태에 그 상태의 `stallsAfterDays` 이상 머물러 있는 교인을 오래된 순으로 반환한다.',
      '',
      '- 기준 일수는 **재적상태별 설정값**이다(방문 30일 / 새가족 90일 …). `null` 인 상태는 판정하지 않는다 —',
      '  파송·이명·별세처럼 도착점인 상태는 오래 머무는 게 정상이다.',
      '- `limit` 을 주면 그만큼만 (대시보드 카드용).',
    ].join('\n'),
  })
  stalled(@RequireChurch() auth: AuthContext & { churchId: number }, @Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.statusHistory.listStalled(auth.churchId, limit);
  }

  @Get('transitions')
  @Permissions('member:read')
  @ApiOperation({
    summary: '단계 이동 집계',
    description: '기간 안에 일어난 단계 이동을 `from → to` 별 건수로 반환한다. 기본은 올해. 예: "올해 정착 → 훈련생 4명".',
  })
  transitions(@RequireChurch() auth: AuthContext & { churchId: number }, @Query('from') from?: string, @Query('to') to?: string) {
    const year = new Date().getFullYear();
    return this.statusHistory.transitions(auth.churchId, from || `${year}-01-01`, to || `${year}-12-31`);
  }

  @Get(':id/status-history')
  @Permissions('member:read')
  @ApiOperation({
    summary: '교인 단계 이동 이력',
    description: '오래된 순. 열려 있는 마지막 구간이 현재 상태이고 `endDate` 가 null 이다. `days` 는 그 단계에 머문 일수.',
  })
  statusHistoryOf(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.statusHistory.listFor(auth.churchId, id);
  }

  @Get(':id')
  @Permissions('member:read')
  @ApiOperation({
    summary: '교인 상세',
    description: '기본 정보에 재적상태 이름, 소속(부서/사역팀/목장) 목록, 직분 이력을 합쳐서 반환한다.',
  })
  @ApiNotFoundResponse({ description: '해당 교회에 없는 교인 id' })
  detail(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.members.findById(auth.churchId, id);
  }

  @Post()
  @Permissions('member:write')
  @ApiOperation({
    summary: '교인 등록',
    description: '`statusId` 를 생략하면 활성 재적상태 중 sortOrder 가 가장 앞인 값(보통 "방문")으로 자동 설정된다.',
  })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: CreateMemberDto) {
    return this.members.create(auth.churchId, dto);
  }

  @Patch(':id')
  @Permissions('member:write')
  @ApiOperation({ summary: '교인 정보 수정', description: '보낸 필드만 갱신하고, 갱신된 상세(상세 조회와 같은 형태)를 반환한다.' })
  update(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMemberDto) {
    return this.members.update(auth.churchId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions('member:write')
  @ApiOperation({ summary: '교인 삭제', description: '**soft delete** (deletedAt 기록). 헌금·출석 등 과거 데이터는 그대로 남는다.' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.members.remove(auth.churchId, id);
  }
}
