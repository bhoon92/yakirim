import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { PositionEntity } from '@src/database/entities/position.entity';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { MemberPositionEntity } from '@src/database/entities/member-position.entity';
import { UpsertReferenceDto } from './dto/upsert-reference.dto';
import { UpdateReferenceDto } from './dto/update-reference.dto';
import { createDescription, listDescription, removeDescription, updateDescription } from './reference-swagger';
import { ReferenceService } from './reference.service';

const WHAT = '직분';

@ApiTags(SwaggerTag.REFERENCE)
@ApiAuth()
@Controller('positions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PositionController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get()
  @ApiOperation({
    summary: '직분 목록',
    description: `${listDescription(WHAT, false)}\n\n장로·집사·권사 등. 연도 개념이 없고, 교인에게 부여하는 것은 \`POST /members/{memberId}/position\` 이다.`,
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.referenceService.list(PositionEntity, auth.churchId);
  }

  @Post()
  @Permissions('settings:write')
  @ApiOperation({ summary: '직분 추가', description: createDescription(WHAT, false) })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: UpsertReferenceDto) {
    return this.referenceService.create(PositionEntity, auth.churchId, dto);
  }

  @Patch(':id')
  @Permissions('settings:write')
  @ApiOperation({ summary: '직분 수정', description: updateDescription(WHAT) })
  update(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReferenceDto
  ) {
    return this.referenceService.update(PositionEntity, auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('settings:write')
  @HttpCode(204)
  @ApiOperation({ summary: '직분 삭제', description: removeDescription(WHAT) })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.referenceService.remove(PositionEntity, auth.churchId, id, [
      { entity: MemberPositionEntity, column: 'positionId', label: '사역 역할 이력' },
    ]);
  }
}
