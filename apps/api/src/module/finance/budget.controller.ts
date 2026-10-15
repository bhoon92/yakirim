import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { BudgetService } from './budget.service';

@ApiTags(SwaggerTag.FINANCE)
@ApiAuth()
@Controller('finance/budgets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BudgetController {
  constructor(private readonly budgets: BudgetService) {}

  @Get()
  @Permissions('finance:read')
  @ApiOperation({
    summary: '예산 배정 목록 (집행률 포함)',
    description: [
      '배정액(allocated)과 실제 지출(used), 집행률을 함께 계산해 반환한다. 대상(부서/사역팀/목장) 이름도 붙여준다.',
      '',
      '`used` 는 해당 예산에 연결된(`budgetAllocationId`) 지출 거래의 합계다.',
    ].join('\n'),
  })
  @ApiQuery({ name: 'fiscalYearId', required: false, type: Number, description: '특정 회계연도만 필터. 생략하면 전체.' })
  list(@RequireChurch() auth: AuthContext & { churchId: number }, @Query('fiscalYearId') fiscalYearId?: string) {
    return this.budgets.list(auth.churchId, fiscalYearId ? Number(fiscalYearId) : undefined);
  }

  @Post()
  @Permissions('finance:write')
  @ApiOperation({
    summary: '예산 배정',
    description: [
      '회계연도 × 대상 조직에 금액을 배정한다.',
      '',
      '- `targetKind`: 배정 대상 종류(부서/사역팀/목장), `targetId`: 그 조직의 id',
      '- 존재하지 않는 회계연도·대상이면 404',
    ].join('\n'),
  })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: CreateBudgetDto) {
    return this.budgets.create(auth.churchId, dto);
  }

  @Delete(':id')
  @Permissions('finance:write')
  @HttpCode(204)
  @ApiOperation({ summary: '예산 배정 삭제', description: 'soft delete. 이 예산에 연결됐던 지출 거래 자체는 남는다.' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.budgets.remove(auth.churchId, id);
  }
}
