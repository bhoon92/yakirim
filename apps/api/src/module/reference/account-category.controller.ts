import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { AccountCategoryEntity } from '@src/database/entities/account-category.entity';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { FinanceTransactionEntity } from '@src/database/entities/finance-transaction.entity';
import { UpsertReferenceDto } from './dto/upsert-reference.dto';
import { UpdateReferenceDto } from './dto/update-reference.dto';
import { createDescription, listDescription, removeDescription, updateDescription } from './reference-swagger';
import { ReferenceService } from './reference.service';

const WHAT = '계정과목';

@ApiTags(SwaggerTag.REFERENCE)
@ApiAuth()
@Controller('account-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountCategoryController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get()
  @ApiOperation({
    summary: '계정과목 목록',
    description: `${listDescription(WHAT, false)}\n\n예산 배정과 수입지출 분류의 기준. 예산·수입지출 API 의 \`accountCategoryId\` 가 여기서 나온다.`,
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.referenceService.list(AccountCategoryEntity, auth.churchId);
  }

  @Post()
  @Permissions('settings:write')
  @ApiOperation({ summary: '계정과목 추가', description: createDescription(WHAT, false) })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: UpsertReferenceDto) {
    return this.referenceService.create(AccountCategoryEntity, auth.churchId, dto);
  }

  @Patch(':id')
  @Permissions('settings:write')
  @ApiOperation({ summary: '계정과목 수정', description: updateDescription(WHAT) })
  update(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReferenceDto
  ) {
    return this.referenceService.update(AccountCategoryEntity, auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('settings:write')
  @HttpCode(204)
  @ApiOperation({ summary: '계정과목 삭제', description: `${removeDescription(WHAT)} 예산·수입지출 기록이 걸려 있으면 특히 주의.` })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.referenceService.remove(AccountCategoryEntity, auth.churchId, id, [
      { entity: FinanceTransactionEntity, column: 'accountCategoryId', label: '수입지출 기록' },
    ]);
  }
}
