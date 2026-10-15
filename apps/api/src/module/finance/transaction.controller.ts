import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionService } from './transaction.service';

@ApiTags(SwaggerTag.FINANCE)
@ApiAuth()
@Controller('finance/transactions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TransactionController {
  constructor(private readonly transactions: TransactionService) {}

  @Get()
  @Permissions('finance:read')
  @ApiOperation({
    summary: '수입지출 목록 (최근 100건)',
    description: '최신순 **100건 고정**이다(페이징 쿼리 없음). 전체 데이터가 필요하면 `GET /export/transactions` 로 엑셀을 받는 편이 낫다.',
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.transactions.list(auth.churchId, 100);
  }

  @Post()
  @Permissions('finance:write')
  @ApiOperation({
    summary: '수입지출 등록',
    description: [
      '실제 현금 흐름 한 건을 기록한다. 입력자는 토큰의 계정으로 자동 기록되고 `date` 생략 시 오늘.',
      '',
      '- `flow`: 수입/지출',
      '- `budgetAllocationId` 를 함께 넘기면 그 예산의 집행액(used)에 잡힌다 → 예산 집행률에 반영',
      '- `accountCategoryId` 는 계정과목 분류용',
    ].join('\n'),
  })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: CreateTransactionDto) {
    return this.transactions.create(auth.churchId, auth.accountId, dto);
  }

  @Delete(':id')
  @Permissions('finance:write')
  @HttpCode(204)
  @ApiOperation({ summary: '수입지출 삭제', description: 'soft delete. 예산 집행률에서도 즉시 빠진다.' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.transactions.remove(auth.churchId, id);
  }
}
