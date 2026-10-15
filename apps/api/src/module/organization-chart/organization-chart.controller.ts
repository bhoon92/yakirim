import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { OrganizationChartService } from './organization-chart.service';

type Auth = AuthContext & { churchId: number };

@ApiTags(SwaggerTag.ORGANIZATION_CHART)
@ApiAuth()
@Controller('organization-chart')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationChartController {
  constructor(private readonly orgChart: OrganizationChartService) {}

  @Get()
  @Permissions('member:read')
  @ApiOperation({
    summary: '조직도 조회 (연도별)',
    description: [
      '해당 연도의 부서·사역팀·목장을 각각 조직 단위 배열로 반환한다.',
      '',
      '- 응답 형태: `{ department: Unit[], ministry: Unit[], smallGroup: Unit[] }`',
      '- 각 Unit 은 조직 이름과 구성원 목록을 갖고, 리더(`isLeader`)와 호칭(`roleLabel`)이 함께 내려온다.',
      '- 종료된 소속(endDate 채워진 이력)은 제외된다.',
    ].join('\n'),
  })
  @ApiQuery({ name: 'year', required: false, type: Number, description: '조회 연도. 생략하면 서버의 현재 연도.', example: 2026 })
  tree(@RequireChurch() auth: Auth, @Query('year') year?: string) {
    return this.orgChart.tree(auth.churchId, year ? Number(year) : new Date().getFullYear());
  }
}
