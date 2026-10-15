import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { OfferingCategoryEntity } from '@src/database/entities/offering-category.entity';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { OfferingEntity } from '@src/database/entities/offering.entity';
import { UpsertReferenceDto } from './dto/upsert-reference.dto';
import { UpdateReferenceDto } from './dto/update-reference.dto';
import { createDescription, listDescription, removeDescription, updateDescription } from './reference-swagger';
import { ReferenceService } from './reference.service';

const WHAT = '헌금 항목';

@ApiTags(SwaggerTag.REFERENCE)
@ApiAuth()
@Controller('offering-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OfferingCategoryController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get()
  @ApiOperation({
    summary: '헌금 항목 목록',
    description: `${listDescription(WHAT, false)}\n\n십일조·감사·주정헌금 등. 헌금 등록 시 \`categoryId\` 가 여기서 나온다.`,
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.referenceService.list(OfferingCategoryEntity, auth.churchId);
  }

  @Post()
  @Permissions('settings:write')
  @ApiOperation({ summary: '헌금 항목 추가', description: createDescription(WHAT, false) })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: UpsertReferenceDto) {
    return this.referenceService.create(OfferingCategoryEntity, auth.churchId, dto);
  }

  @Patch(':id')
  @Permissions('settings:write')
  @ApiOperation({ summary: '헌금 항목 수정', description: updateDescription(WHAT) })
  update(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReferenceDto
  ) {
    return this.referenceService.update(OfferingCategoryEntity, auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('settings:write')
  @HttpCode(204)
  @ApiOperation({ summary: '헌금 항목 삭제', description: `${removeDescription(WHAT)} 과거 헌금 기록은 그대로 남는다.` })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.referenceService.remove(OfferingCategoryEntity, auth.churchId, id, [
      { entity: OfferingEntity, column: 'offeringCategoryId', label: '헌금 기록' },
    ]);
  }
}
