import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { FellowshipTableEntity } from '@src/database/entities/fellowship-table.entity';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { MemberFellowshipTableEntity } from '@src/database/entities/member-fellowship-table.entity';
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

/** 테이블 — 예배 후 나눔 자리. 공동체(하우스)와 같은 연도별 기준정보 틀을 쓴다. 예산 배정 대상은 아니다. */
const WHAT = '테이블(예배 후 나눔)';

@ApiTags(SwaggerTag.REFERENCE)
@ApiAuth()
@Controller('tables')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FellowshipTableController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get()
  @ApiOperation({ summary: '테이블 목록 (연도별)', description: listDescription(WHAT, true) })
  @ApiYearQuery()
  list(@RequireChurch() auth: AuthContext & { churchId: number }, @Query('year', ParseIntPipe) year: number) {
    return this.referenceService.list(FellowshipTableEntity, auth.churchId, year);
  }

  @Post()
  @Permissions('settings:write')
  @ApiOperation({ summary: '테이블 추가', description: createDescription(WHAT, true) })
  @ApiYearQuery()
  create(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Query('year', ParseIntPipe) year: number,
    @Body() dto: UpsertReferenceDto
  ) {
    return this.referenceService.create(FellowshipTableEntity, auth.churchId, dto, year);
  }

  @Post('copy')
  @Permissions('settings:write')
  @ApiOperation({ summary: '테이블 구성 연도 복제', description: copyDescription(WHAT) })
  @ApiCopyYearQueries()
  copy(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Query('from', ParseIntPipe) fromYear: number,
    @Query('to', ParseIntPipe) toYear: number
  ) {
    return this.referenceService.copyYear(FellowshipTableEntity, auth.churchId, fromYear, toYear);
  }

  @Patch(':id')
  @Permissions('settings:write')
  @ApiOperation({ summary: '테이블 수정', description: updateDescription(WHAT) })
  update(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReferenceDto
  ) {
    return this.referenceService.update(FellowshipTableEntity, auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('settings:write')
  @HttpCode(204)
  @ApiOperation({ summary: '테이블 삭제', description: removeDescription(WHAT) })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.referenceService.remove(FellowshipTableEntity, auth.churchId, id, [
      { entity: MemberFellowshipTableEntity, column: 'tableId', label: '소속 이력' },
    ]);
  }
}
