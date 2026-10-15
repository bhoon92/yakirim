import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { DashboardService } from './dashboard.service';

@ApiTags(SwaggerTag.FINANCE)
@ApiAuth()
@Controller('finance/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @Permissions('finance:read')
  @ApiOperation({
    summary: '재정 대시보드 (이번 달)',
    description: [
      '이번 달 헌금/수입/지출 합계와 현재 회계연도 예산 집행률을 한 번에 반환한다.',
      '',
      '- `month`: 기준 월 (YYYY-MM)',
      '- `fiscalYear`: current 로 지정된 회계연도 (없으면 null)',
      '- `budget`: `{ allocated, used, rate }` — 회계연도가 없으면 null',
    ].join('\n'),
  })
  summary(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.dashboard.summary(auth.churchId);
  }
}
