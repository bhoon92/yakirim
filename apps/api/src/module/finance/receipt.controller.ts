import { Controller, Get, Param, ParseIntPipe, Res, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { ReceiptService } from './receipt.service';

@ApiTags(SwaggerTag.FINANCE)
@ApiAuth()
@Controller('finance/offerings/receipt')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReceiptController {
  constructor(private readonly receipts: ReceiptService) {}

  /** 연말정산 기부금영수증 PDF 다운로드. */
  @Get(':memberId/:year')
  @Permissions('finance:read')
  @ApiOperation({
    summary: '기부금영수증 PDF 다운로드',
    description: [
      '해당 교인의 연간 헌금을 항목별로 정리한 기부금영수증을 **PDF 바이너리**로 반환한다 (JSON 아님).',
      '',
      '`Content-Disposition: attachment` 가 붙어 브라우저에서 바로 다운로드된다. 금액 데이터만 필요하면',
      '`GET /finance/offerings/summary/{memberId}/{year}` 를 쓰면 된다.',
    ].join('\n'),
  })
  @ApiParam({ name: 'memberId', description: '교인 id', type: Number })
  @ApiParam({ name: 'year', description: '정산 연도 (예: 2025)', type: Number })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'PDF 파일', schema: { type: 'string', format: 'binary' } })
  async download(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('memberId', ParseIntPipe) memberId: number,
    @Param('year', ParseIntPipe) year: number,
    @Res() res: Response
  ) {
    const { buffer, filename } = await this.receipts.generate(auth.churchId, memberId, year);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  }
}
