import { Body, Controller, Delete, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiConflictResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { AffiliationService } from './affiliation.service';
import { AssignAffiliationDto } from './dto/assign.dto';
import { SetLeaderDto } from './dto/set-leader.dto';

type Auth = AuthContext & { churchId: number };

/**
 * 부서/사역팀/목장 세 종류가 완전히 같은 3종 세트(배정·리더·종료)를 이룬다.
 * 세 리소스의 동작 설명이 동일하므로 Swagger 설명도 아래 상수를 공유한다.
 */
const ASSIGN_DESCRIPTION = [
  '교인을 해당 조직에 배정한다. `referenceId` 는 기준정보(reference)의 id.',
  '',
  '- `startDate` 생략 시 오늘로 기록된다.',
  '- 같은 조직에 **활성 소속(endDate 가 비어있음)** 이 이미 있으면 409.',
  '- 배정과 동시에 `isLeader`·`roleLabel`(예: "부장", "총무")을 함께 넘길 수 있다.',
].join('\n');

const LEADER_DESCRIPTION = '활성 소속의 리더 여부와 호칭(roleLabel)을 변경한다. 조직도에서 이 값으로 리더 줄과 직함이 그려진다.';
const END_DESCRIPTION = '소속을 **종료**한다. row 를 지우지 않고 endDate 를 오늘로 채워 이력을 남긴다. 활성 소속이 없으면 404.';
const MEMBER_ID_PARAM = { name: 'memberId', description: '교인 id', type: Number } as const;
const REFERENCE_ID_PARAM = { name: 'referenceId', description: '기준정보(부서/사역팀/목장) id', type: Number } as const;

@ApiTags(SwaggerTag.AFFILIATION)
@ApiAuth()
@ApiParam(MEMBER_ID_PARAM)
@Controller('members/:memberId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AffiliationController {
  constructor(private readonly affiliationService: AffiliationService) {}

  @Post('departments')
  @Permissions('member:write')
  @ApiOperation({ summary: '부서 배정', description: ASSIGN_DESCRIPTION })
  @ApiConflictResponse({ description: '이미 활성 소속이 있음' })
  assignDepartment(@RequireChurch() auth: Auth, @Param('memberId', ParseIntPipe) memberId: number, @Body() dto: AssignAffiliationDto) {
    return this.affiliationService.assign('department', auth.churchId, memberId, dto);
  }

  @Delete('departments/:referenceId')
  @Permissions('member:write')
  @HttpCode(204)
  @ApiOperation({ summary: '부서 소속 종료', description: END_DESCRIPTION })
  @ApiParam(REFERENCE_ID_PARAM)
  @ApiNoContentResponse({ description: '종료 완료' })
  @ApiNotFoundResponse({ description: '활성 소속 없음' })
  endDepartment(
    @RequireChurch() auth: Auth,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Param('referenceId', ParseIntPipe) referenceId: number
  ) {
    return this.affiliationService.end('department', auth.churchId, memberId, referenceId);
  }

  @Patch('departments/:referenceId/leader')
  @Permissions('member:write')
  @ApiOperation({ summary: '부서 리더 지정/해제', description: LEADER_DESCRIPTION })
  @ApiParam(REFERENCE_ID_PARAM)
  leaderDepartment(
    @RequireChurch() auth: Auth,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Param('referenceId', ParseIntPipe) referenceId: number,
    @Body() dto: SetLeaderDto
  ) {
    return this.affiliationService.setLeader('department', auth.churchId, memberId, referenceId, dto.isLeader, dto.roleLabel);
  }

  @Post('ministries')
  @Permissions('member:write')
  @ApiOperation({ summary: '사역팀 배정', description: ASSIGN_DESCRIPTION })
  @ApiConflictResponse({ description: '이미 활성 소속이 있음' })
  assignMinistry(@RequireChurch() auth: Auth, @Param('memberId', ParseIntPipe) memberId: number, @Body() dto: AssignAffiliationDto) {
    return this.affiliationService.assign('ministry', auth.churchId, memberId, dto);
  }

  @Patch('ministries/:referenceId/leader')
  @Permissions('member:write')
  @ApiOperation({ summary: '사역팀 리더 지정/해제', description: LEADER_DESCRIPTION })
  @ApiParam(REFERENCE_ID_PARAM)
  leaderMinistry(
    @RequireChurch() auth: Auth,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Param('referenceId', ParseIntPipe) referenceId: number,
    @Body() dto: SetLeaderDto
  ) {
    return this.affiliationService.setLeader('ministry', auth.churchId, memberId, referenceId, dto.isLeader, dto.roleLabel);
  }

  @Delete('ministries/:referenceId')
  @Permissions('member:write')
  @HttpCode(204)
  @ApiOperation({ summary: '사역팀 소속 종료', description: END_DESCRIPTION })
  @ApiParam(REFERENCE_ID_PARAM)
  @ApiNoContentResponse({ description: '종료 완료' })
  @ApiNotFoundResponse({ description: '활성 소속 없음' })
  endMinistry(
    @RequireChurch() auth: Auth,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Param('referenceId', ParseIntPipe) referenceId: number
  ) {
    return this.affiliationService.end('ministry', auth.churchId, memberId, referenceId);
  }

  @Post('small-groups')
  @Permissions('member:write')
  @ApiOperation({ summary: '목장 배정', description: ASSIGN_DESCRIPTION })
  @ApiConflictResponse({ description: '이미 활성 소속이 있음' })
  assignSmallGroup(@RequireChurch() auth: Auth, @Param('memberId', ParseIntPipe) memberId: number, @Body() dto: AssignAffiliationDto) {
    return this.affiliationService.assign('smallGroup', auth.churchId, memberId, dto);
  }

  @Patch('small-groups/:referenceId/leader')
  @Permissions('member:write')
  @ApiOperation({ summary: '목장 리더(목자) 지정/해제', description: LEADER_DESCRIPTION })
  @ApiParam(REFERENCE_ID_PARAM)
  leaderSmallGroup(
    @RequireChurch() auth: Auth,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Param('referenceId', ParseIntPipe) referenceId: number,
    @Body() dto: SetLeaderDto
  ) {
    return this.affiliationService.setLeader('smallGroup', auth.churchId, memberId, referenceId, dto.isLeader, dto.roleLabel);
  }

  @Delete('small-groups/:referenceId')
  @Permissions('member:write')
  @HttpCode(204)
  @ApiOperation({ summary: '목장 소속 종료', description: END_DESCRIPTION })
  @ApiParam(REFERENCE_ID_PARAM)
  @ApiNoContentResponse({ description: '종료 완료' })
  @ApiNotFoundResponse({ description: '활성 소속 없음' })
  endSmallGroup(
    @RequireChurch() auth: Auth,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Param('referenceId', ParseIntPipe) referenceId: number
  ) {
    return this.affiliationService.end('smallGroup', auth.churchId, memberId, referenceId);
  }
}
