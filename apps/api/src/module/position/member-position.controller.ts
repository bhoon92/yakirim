import { Body, Controller, Delete, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { PromotePositionDto } from './dto/promote.dto';
import { MemberPositionService } from './member-position.service';

@ApiTags(SwaggerTag.POSITION)
@ApiAuth()
@ApiParam({ name: 'memberId', description: '교인 id', type: Number })
@Controller('members/:memberId/position')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MemberPositionController {
  constructor(private readonly positions: MemberPositionService) {}

  /** 직분 부여/승직 — 현재 직분은 자동 종료, 새 row 생성 (트랜잭션). */
  @Post()
  @Permissions('member:write')
  @ApiOperation({
    summary: '직분 부여 / 승직',
    description: [
      '현재 직분이 있으면 종료 처리하고 새 직분 이력을 만든다 (한 트랜잭션이라 중간 상태가 남지 않는다).',
      '',
      '교인의 직분 이력은 교인 상세 조회(`GET /members/{id}`)의 `position` 필드에서 볼 수 있다.',
    ].join('\n'),
  })
  promote(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: PromotePositionDto
  ) {
    return this.positions.promote(auth.churchId, memberId, dto);
  }

  /** 현재 직분 종료 (다음 부여 없이 비워두기). */
  @Delete()
  @Permissions('member:write')
  @HttpCode(204)
  @ApiOperation({ summary: '현재 직분 종료', description: '다음 직분을 주지 않고 비워둘 때 사용. 지난 이력은 남는다.' })
  @ApiNoContentResponse({ description: '종료 완료' })
  endCurrent(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('memberId', ParseIntPipe) memberId: number) {
    return this.positions.endCurrent(auth.churchId, memberId);
  }
}
