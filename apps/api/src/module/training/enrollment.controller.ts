import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { UpdateEnrollmentDto } from './dto/cohort.dto';
import { TrainingEnrollmentService } from './enrollment.service';

type Auth = AuthContext & { churchId: number };

@ApiTags(SwaggerTag.TRAINING)
@ApiAuth()
@Controller('training')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TrainingEnrollmentController {
  constructor(private readonly enrollments: TrainingEnrollmentService) {}

  @Patch('enrollments/:id')
  @Permissions('training:write')
  @ApiOperation({
    summary: '수료 / 중도포기 확정',
    description: [
      '`status` 를 `completed`(수료) 또는 `dropped`(중도포기)로 바꾼다. `closedAt` 생략 시 오늘로 기록.',
      '',
      '**출석률로 자동 수료 처리하지 않는 것은 의도된 설계다** — 합숙·순종 중심 훈련이라 출석 횟수만으로 수료가 결정되지 않는다.',
      '출석률은 기수 상세에서 참고용으로 보여준다.',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', description: '수강(enrollment) id', type: Number })
  updateStatus(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEnrollmentDto) {
    return this.enrollments.updateStatus(auth.churchId, id, dto);
  }

  @Delete('enrollments/:id')
  @Permissions('training:write')
  @HttpCode(204)
  @ApiOperation({ summary: '수강 취소', description: '잘못 등록한 경우. 출석 기록도 함께 정리된다.' })
  @ApiParam({ name: 'id', description: '수강(enrollment) id', type: Number })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number) {
    return this.enrollments.remove(auth.churchId, id);
  }

  @Get('members/:memberId')
  @Permissions('training:read')
  @ApiOperation({
    summary: '교인별 훈련 이력',
    description: '이 사람이 무엇을 통과했는지 — 기수 라벨("믿음학교 5기"), 수료 여부, 출석률을 최신순으로. 교인 상세 화면의 양성 경로.',
  })
  @ApiParam({ name: 'memberId', description: '교인 id', type: Number })
  history(@RequireChurch() auth: Auth, @Param('memberId', ParseIntPipe) memberId: number) {
    return this.enrollments.historyForMember(auth.churchId, memberId);
  }
}
