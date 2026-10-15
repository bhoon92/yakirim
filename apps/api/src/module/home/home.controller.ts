import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { HomeService } from './home.service';

@ApiTags(SwaggerTag.DASHBOARD)
@ApiAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  @ApiOperation({
    summary: '홈 대시보드 요약 (양성 파이프라인 중심)',
    description: [
      '홈 화면 한 판을 채우는 집계를 한 번에 반환한다. 별도 권한 검사 없이 로그인 + 활성 교회만 요구.',
      '',
      '이 교회의 핵심 지표는 출석·헌금이 아니라 **얼마나 배출했는가**라서 그 축으로 구성돼 있다',
      '(재정 지표는 `GET /finance/dashboard` 로 분리).',
      '',
      '- `stats.activeMissionaries`: 현재 파송 인원 (파송확정·현지·안식년)',
      '- `stats.commissionedThisYear`: 올해 파송 확정',
      '- `stats.ongoingCohorts`: 진행 중 훈련 기수 수',
      '- `stats.completedThisYear`: 올해 훈련 수료 인원',
      '- `pipeline`: 재적상태(단계)별 인원 — 방문 → 새가족 → 정착 → 훈련생 → 사역자 → 파송',
      '- `training`: 진행 중 기수 목록 (수강 인원·회차 수 포함)',
      '- `schedule`: 오늘 일정',
      '- `activity`: 최근 활동 — 수료·파송 전이를 우선으로 등록/헌금/지출을 섞어 최신 8건',
    ].join('\n'),
  })
  summary(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.home.summary(auth.churchId);
  }
}
