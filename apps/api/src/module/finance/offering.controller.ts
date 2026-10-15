import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';
import { ListOfferingQueryDto } from './dto/list-offering.dto';
import { OfferingService } from './offering.service';

@ApiTags(SwaggerTag.FINANCE)
@ApiAuth()
@Controller('finance/offerings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OfferingController {
  constructor(private readonly offerings: OfferingService) {}

  @Get()
  @Permissions('finance:read')
  @ApiOperation({
    summary: '헌금 목록',
    description: [
      '날짜 내림차순으로 반환하며 교인 이름·헌금항목 이름이 붙는다. 응답은 `{ items, total, count }` (`total` 은 금액 합계).',
      '',
      '쿼리(`date`, `worshipServiceId`, `memberId`)는 모두 선택이며 AND 로 걸린다. 아무 것도 안 주면 전체 기간이 나온다.',
    ].join('\n'),
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }, @Query() query: ListOfferingQueryDto) {
    return this.offerings.list(auth.churchId, query);
  }

  @Post()
  @Permissions('finance:write')
  @ApiOperation({
    summary: '헌금 등록',
    description: [
      '입력자는 토큰의 계정으로 자동 기록된다. `date` 를 생략하면 오늘.',
      '',
      '`rawDonorName` 은 봉투에 적힌 이름을 원문 그대로 남기고 싶을 때 쓴다(교인 매칭과 별개).',
    ].join('\n'),
  })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: CreateOfferingDto) {
    return this.offerings.create(auth.churchId, auth.accountId, dto);
  }

  @Patch(':id')
  @Permissions('finance:write')
  @ApiOperation({ summary: '헌금 수정', description: '보낸 필드만 갱신한다. 금액·항목 정정에 사용.' })
  update(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOfferingDto) {
    return this.offerings.update(auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('finance:write')
  @HttpCode(204)
  @ApiOperation({ summary: '헌금 삭제', description: 'soft delete 이며 합계·영수증 집계에서 즉시 빠진다.' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.offerings.remove(auth.churchId, id);
  }

  /** 연말정산 영수증용 — member 별 calendar-year 합계. */
  @Get('summary/:memberId/:year')
  @Permissions('finance:read')
  @ApiOperation({
    summary: '교인 연간 헌금 합계',
    description: [
      '해당 교인의 1/1~12/31 헌금을 항목별로 합산해 반환한다 (`{ year, total, byCategory[] }`).',
      '',
      '같은 데이터를 PDF 로 받으려면 `GET /finance/offerings/receipt/{memberId}/{year}`.',
    ].join('\n'),
  })
  @ApiParam({ name: 'memberId', description: '교인 id', type: Number })
  @ApiParam({ name: 'year', description: '조회 연도 (예: 2025)', type: Number })
  summary(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('memberId', ParseIntPipe) memberId: number,
    @Param('year', ParseIntPipe) year: number
  ) {
    return this.offerings.memberAnnualSummary(auth.churchId, memberId, year);
  }
}
