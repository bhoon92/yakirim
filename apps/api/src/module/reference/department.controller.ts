import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { DepartmentEntity } from '@src/database/entities/department.entity';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { MemberDepartmentEntity } from '@src/database/entities/member-department.entity';
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

const WHAT = '부서';

@ApiTags(SwaggerTag.REFERENCE)
@ApiAuth()
@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get()
  @ApiOperation({ summary: '부서 목록 (연도별)', description: listDescription(WHAT, true) })
  @ApiYearQuery()
  list(@RequireChurch() auth: AuthContext & { churchId: number }, @Query('year', ParseIntPipe) year: number) {
    return this.referenceService.list(DepartmentEntity, auth.churchId, year);
  }

  @Post()
  @Permissions('settings:write')
  @ApiOperation({ summary: '부서 추가', description: createDescription(WHAT, true) })
  @ApiYearQuery()
  create(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Query('year', ParseIntPipe) year: number,
    @Body() dto: UpsertReferenceDto
  ) {
    return this.referenceService.create(DepartmentEntity, auth.churchId, dto, year);
  }

  @Post('copy')
  @Permissions('settings:write')
  @ApiOperation({ summary: '부서 구성 연도 복제', description: copyDescription(WHAT) })
  @ApiCopyYearQueries()
  copy(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Query('from', ParseIntPipe) fromYear: number,
    @Query('to', ParseIntPipe) toYear: number
  ) {
    return this.referenceService.copyYear(DepartmentEntity, auth.churchId, fromYear, toYear);
  }

  @Patch(':id')
  @Permissions('settings:write')
  @ApiOperation({ summary: '부서 수정', description: updateDescription(WHAT) })
  update(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReferenceDto
  ) {
    return this.referenceService.update(DepartmentEntity, auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('settings:write')
  @HttpCode(204)
  @ApiOperation({ summary: '부서 삭제', description: removeDescription(WHAT) })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.referenceService.remove(DepartmentEntity, auth.churchId, id, [
      { entity: MemberDepartmentEntity, column: 'departmentId', label: '소속 이력' },
      { entity: BudgetAllocationEntity, column: 'targetId', label: '예산 배정', extraWhere: { targetKind: BudgetTargetKind.DEPARTMENT } },
    ]);
  }
}
