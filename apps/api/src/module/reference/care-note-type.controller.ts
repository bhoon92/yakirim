import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { CareNoteEntity } from '@src/database/entities/care-note.entity';
import { CareNoteTypeEntity } from '@src/database/entities/care-note-type.entity';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { UpsertReferenceDto } from './dto/upsert-reference.dto';
import { UpdateReferenceDto } from './dto/update-reference.dto';
import { createDescription, listDescription, removeDescription, updateDescription } from './reference-swagger';
import { ReferenceService } from './reference.service';

const WHAT = '양육기록 종류';

@ApiTags(SwaggerTag.REFERENCE)
@ApiAuth()
@Controller('care-note-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CareNoteTypeController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get()
  @ApiOperation({
    summary: '양육기록 종류 목록',
    description: `${listDescription(WHAT, false)}\n\n심방·면담·양육·상담·파송보고 등. 교회가 자유롭게 늘리거나 이름을 바꿀 수 있다.`,
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.referenceService.list(CareNoteTypeEntity, auth.churchId);
  }

  @Post()
  @Permissions('settings:write')
  @ApiOperation({ summary: '양육기록 종류 추가', description: createDescription(WHAT, false) })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: UpsertReferenceDto) {
    return this.referenceService.create(CareNoteTypeEntity, auth.churchId, dto);
  }

  @Patch(':id')
  @Permissions('settings:write')
  @ApiOperation({ summary: '양육기록 종류 수정', description: updateDescription(WHAT) })
  update(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReferenceDto
  ) {
    return this.referenceService.update(CareNoteTypeEntity, auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('settings:write')
  @HttpCode(204)
  @ApiOperation({ summary: '양육기록 종류 삭제', description: `${removeDescription(WHAT)}\n\n이 종류로 쓴 기록이 있으면 409.` })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.referenceService.remove(CareNoteTypeEntity, auth.churchId, id, [
      { entity: CareNoteEntity, column: 'typeId', label: '양육 기록' },
    ]);
  }
}
