import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { CreateFiscalYearDto } from './dto/create-fiscal-year.dto';
import { FiscalYearService } from './fiscal-year.service';

@ApiTags(SwaggerTag.FINANCE)
@ApiAuth()
@Controller('finance/fiscal-years')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FiscalYearController {
  constructor(private readonly fiscalYears: FiscalYearService) {}

  @Get()
  @Permissions('finance:read')
  @ApiOperation({
    summary: '회계연도 목록',
    description: '예산·집행의 기준이 되는 기간 목록. 하나만 `isCurrent: true` 이고, 대시보드는 그 연도를 기준으로 집행률을 계산한다.',
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.fiscalYears.list(auth.churchId);
  }

  @Post()
  @Permissions('finance:write')
  @ApiOperation({
    summary: '회계연도 생성',
    description: '`startDate`~`endDate` 로 기간을 정한다(YYYY-MM-DD). `isCurrent: true` 로 만들면 기존 current 는 자동으로 내려간다.',
  })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: CreateFiscalYearDto) {
    return this.fiscalYears.create(auth.churchId, dto);
  }

  @Post(':id/current')
  @Permissions('finance:write')
  @ApiOperation({ summary: '현재 회계연도 지정', description: '이 연도를 current 로 올리고 나머지는 내린다. 연초 전환 시 호출.' })
  setCurrent(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.fiscalYears.setCurrent(auth.churchId, id);
  }

  @Delete(':id')
  @Permissions('finance:write')
  @HttpCode(204)
  @ApiOperation({ summary: '회계연도 삭제', description: '예산이 이미 배정된 연도라면 삭제 전에 예산을 먼저 정리해야 한다.' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.fiscalYears.remove(auth.churchId, id);
  }
}
