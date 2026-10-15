import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { CreateMemberStatusDto, UpdateMemberStatusDto } from './dto/member-status.dto';
import { MemberStatusService } from './member-status.service';

@ApiTags(SwaggerTag.MEMBER)
@ApiAuth()
@Controller('member-statuses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MemberStatusController {
  constructor(private readonly statuses: MemberStatusService) {}

  @Get()
  @ApiOperation({
    summary: '재적상태 목록',
    description: '교인의 재적 구분(방문/등록/장기결석/이명 등) 코드. 교회 생성 시 기본값이 함께 만들어진다. 읽기는 별도 권한 없이 가능.',
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.statuses.list(auth.churchId);
  }

  @Post()
  @Permissions('settings:write')
  @ApiOperation({ summary: '재적상태 추가', description: '`sortOrder` 가 가장 앞인 활성 상태가 신규 교인의 기본값이 된다.' })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: CreateMemberStatusDto) {
    return this.statuses.create(auth.churchId, dto);
  }

  @Patch(':id')
  @Permissions('settings:write')
  @ApiOperation({
    summary: '재적상태 수정',
    description: [
      '이름·정렬순서·활성여부 변경. 이 상태를 쓰던 교인의 statusId 는 그대로 유지된다.',
      '',
      '`stallsAfterDays` 는 이 단계에 며칠 이상 머무르면 "정체"로 볼지의 기준이다. 대시보드 카드와',
      '`GET /members?stalled=true` 가 같은 값을 쓴다. `null` 을 보내면 이 단계는 정체 판정에서 빠진다.',
    ].join('\n'),
  })
  update(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMemberStatusDto
  ) {
    return this.statuses.update(auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('settings:write')
  @HttpCode(204)
  @ApiOperation({ summary: '재적상태 삭제', description: '사용 중인 상태라면 삭제 대신 `isActive: false` 로 비활성화하는 편이 안전하다.' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.statuses.remove(auth.churchId, id);
  }
}
