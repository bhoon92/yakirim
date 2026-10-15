import { Controller, Get, Param, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { ExportService } from './export.service';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 엑셀 응답 공통 문서 — JSON 이 아니라 첨부파일이라는 점을 매 엔드포인트에 명시. */
const XLSX_RESPONSE = { description: 'XLSX 파일 (Content-Disposition: attachment)', schema: { type: 'string', format: 'binary' } } as const;

@ApiTags(SwaggerTag.EXPORT)
@ApiAuth()
@ApiProduces(XLSX_MIME)
@Controller('export')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get('offerings/:year')
  @Permissions('finance:read')
  @ApiOperation({
    summary: '헌금 내역 엑셀',
    description:
      '해당 연도(1/1~12/31) 헌금 전체를 `offerings-{year}.xlsx` 로 내려준다. Swagger UI 에서는 응답 본문 대신 다운로드 링크로 보인다.',
  })
  @ApiParam({ name: 'year', description: '대상 연도 (예: 2025)', type: Number })
  @ApiOkResponse(XLSX_RESPONSE)
  async offerings(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('year', ParseIntPipe) year: number,
    @Res() res: Response
  ) {
    this.send(res, await this.exports.offerings_xlsx(auth.churchId, year), `offerings-${year}.xlsx`);
  }

  @Get('transactions')
  @Permissions('finance:read')
  @ApiOperation({
    summary: '수입지출 내역 엑셀',
    description: '기간 필터 없이 **전체** 수입지출을 내려준다. 목록 API 는 최근 100건만 주므로 전량이 필요할 때 이 쪽을 쓴다.',
  })
  @ApiOkResponse(XLSX_RESPONSE)
  async transactions(@RequireChurch() auth: AuthContext & { churchId: number }, @Res() res: Response) {
    this.send(res, await this.exports.transactions_xlsx(auth.churchId), 'transactions.xlsx');
  }

  @Get('budgets')
  @Permissions('finance:read')
  @ApiOperation({ summary: '예산 집행 엑셀', description: '예산 배정액과 집행액·집행률을 정리해 내려준다.' })
  @ApiQuery({ name: 'fiscalYearId', required: false, type: Number, description: '특정 회계연도만. 생략하면 전체.' })
  @ApiOkResponse(XLSX_RESPONSE)
  async budgets(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Res() res: Response,
    @Query('fiscalYearId') fiscalYearId?: string
  ) {
    const buffer = await this.exports.budgets_xlsx(auth.churchId, fiscalYearId ? Number(fiscalYearId) : undefined);
    this.send(res, buffer, 'budgets.xlsx');
  }

  @Get('members')
  @Permissions('member:read')
  @ApiOperation({ summary: '교인 명부 엑셀', description: '교인 명부 전체를 내려준다. 재정이 아니라 `member:read` 권한을 쓴다.' })
  @ApiOkResponse(XLSX_RESPONSE)
  async members(@RequireChurch() auth: AuthContext & { churchId: number }, @Res() res: Response) {
    this.send(res, await this.exports.members_xlsx(auth.churchId), 'members.xlsx');
  }

  private send(res: Response, buffer: Buffer, filename: string) {
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  }
}
