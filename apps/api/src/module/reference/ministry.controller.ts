import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { MinistryEntity } from '@src/database/entities/ministry.entity';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { MemberMinistryEntity } from '@src/database/entities/member-ministry.entity';
import { MissionaryProfileEntity } from '@src/database/entities/missionary-profile.entity';
import { BudgetAllocationEntity, BudgetTargetKind } from '@src/database/entities/budget-allocation.entity';
import { UpsertReferenceDto } from './dto/upsert-reference.dto';
import { UpdateReferenceDto } from './dto/update-reference.dto';
import {
  ApiCopyYearQueries,
  ApiYearQuery,
  copyDescription,
  createDescription,
  listDescription,
  removeDescription,
  updateDescription,
} from './reference-swagger';
import { ReferenceService } from './reference.service';

const WHAT = '사역팀';

@ApiTags(SwaggerTag.REFERENCE)
@ApiAuth()
@Controller('ministries')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MinistryController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get()
  @ApiOperation({ summary: '사역팀 목록 (연도별)', description: listDescription(WHAT, true) })
  @ApiYearQuery()
  list(@RequireChurch() auth: AuthContext & { churchId: number }, @Query('year', ParseIntPipe) year: number) {
    return this.referenceService.list(MinistryEntity, auth.churchId, year);
  }

  @Post()
  @Permissions('settings:write')
  @ApiOperation({ summary: '사역팀 추가', description: createDescription(WHAT, true) })
  @ApiYearQuery()
  create(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Query('year', ParseIntPipe) year: number,
    @Body() dto: UpsertReferenceDto
  ) {
    return this.referenceService.create(MinistryEntity, auth.churchId, dto, year);
  }

  @Post('copy')
  @Permissions('settings:write')
  @ApiOperation({ summary: '사역팀 구성 연도 복제', description: copyDescription(WHAT) })
  @ApiCopyYearQueries()
  copy(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Query('from', ParseIntPipe) fromYear: number,
    @Query('to', ParseIntPipe) toYear: number
  ) {
    return this.referenceService.copyYear(MinistryEntity, auth.churchId, fromYear, toYear);
  }

  @Patch(':id')
  @Permissions('settings:write')
  @ApiOperation({ summary: '사역팀 수정', description: updateDescription(WHAT) })
  update(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReferenceDto
  ) {
    return this.referenceService.update(MinistryEntity, auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('settings:write')
  @HttpCode(204)
  @ApiOperation({ summary: '사역팀 삭제', description: removeDescription(WHAT) })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.referenceService.remove(MinistryEntity, auth.churchId, id, [
      { entity: MemberMinistryEntity, column: 'ministryId', label: '소속 이력' },
      { entity: MissionaryProfileEntity, column: 'ministryId', label: '선교사 프로필' },
      { entity: BudgetAllocationEntity, column: 'targetId', label: '예산 배정', extraWhere: { targetKind: BudgetTargetKind.MINISTRY } },
    ]);
  }
}
