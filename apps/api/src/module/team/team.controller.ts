import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { InviteMemberDto, LinkMemberDto, UpdateRoleDto } from './dto/team.dto';
import { TeamService } from './team.service';

const MEMBERSHIP_ID_PARAM = { name: 'membershipId', description: '멤버십 id (accountId 가 아님)', type: Number } as const;

@ApiTags(SwaggerTag.TEAM)
@ApiAuth()
@Controller('team')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @Permissions('team:manage')
  @ApiOperation({
    summary: '팀 멤버 목록',
    description: [
      '이 교회를 관리하는 계정과 역할 목록. 각 항목은 `{ membershipId, accountId, email, name, role, pending }`.',
      '',
      '`pending: true` 는 초대만 되어 있고 아직 구글 로그인을 한 번도 하지 않은 계정이다.',
    ].join('\n'),
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.team.list(auth.churchId);
  }

  @Post('invite')
  @Permissions('team:manage')
  @ApiOperation({
    summary: '팀 멤버 초대',
    description: [
      '이메일로 멤버십을 만든다. 아직 가입 안 한 이메일이면 pending 계정을 미리 만들어두고, 그 사람이 같은 이메일로 구글 로그인하면 이어진다.',
      '',
      '메일 발송 기능은 없다(초대 링크를 따로 전달해야 함). `owner` 역할로는 초대할 수 없다.',
    ].join('\n'),
  })
  @ApiBadRequestResponse({ description: 'owner 역할로 초대 시도' })
  invite(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: InviteMemberDto) {
    return this.team.invite(auth.churchId, dto.email, dto.role);
  }

  @Patch(':membershipId')
  @Permissions('team:manage')
  @ApiOperation({
    summary: '역할 변경',
    description: 'admin / staff / viewer 사이에서만 변경 가능. **owner 는 대상도 목표값도 될 수 없다**(403) — 교회 소유권 보호.',
  })
  @ApiParam(MEMBERSHIP_ID_PARAM)
  updateRole(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('membershipId', ParseIntPipe) membershipId: number,
    @Body() dto: UpdateRoleDto
  ) {
    return this.team.updateRole(auth.churchId, membershipId, dto.role);
  }

  @Patch(':membershipId/member')
  @Permissions('team:manage')
  @ApiOperation({
    summary: '계정 ↔ 교인 연결',
    description: [
      '이 계정이 교인 명부의 누구인지 정한다. 간사의 "내가 맡은 사람" 화면이 이 연결로 그 사람을 찾는다.',
      '한 교인은 한 계정에만 연결된다 (다른 계정에 연결돼 있으면 409). `memberId: null` 이면 해제.',
    ].join('\n'),
  })
  @ApiParam(MEMBERSHIP_ID_PARAM)
  linkMember(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('membershipId', ParseIntPipe) membershipId: number,
    @Body() dto: LinkMemberDto
  ) {
    return this.team.linkMember(auth.churchId, membershipId, dto.memberId);
  }

  @Delete(':membershipId')
  @HttpCode(204)
  @Permissions('team:manage')
  @ApiOperation({ summary: '팀 멤버 제거', description: '멤버십을 soft delete 한다(계정 자체는 유지). owner 는 제거할 수 없다.' })
  @ApiParam(MEMBERSHIP_ID_PARAM)
  @ApiNoContentResponse({ description: '제거 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('membershipId', ParseIntPipe) membershipId: number) {
    return this.team.remove(auth.churchId, membershipId);
  }
}
