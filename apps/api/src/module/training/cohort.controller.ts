import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { TrainingCohortService } from './cohort.service';
import {
  ApplyPromotionDto,
  CreateCohortDto,
  EnrollMembersDto,
  ListCohortQueryDto,
  MarkTrainingAttendanceDto,
  UpdateCohortDto,
  UpdateSessionDto,
} from './dto/cohort.dto';
import { TrainingEnrollmentService } from './enrollment.service';
import { TrainingPromotionService } from './promotion.service';

type Auth = AuthContext & { churchId: number };

@ApiTags(SwaggerTag.TRAINING)
@ApiAuth()
@Controller('training/cohorts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TrainingCohortController {
  constructor(
    private readonly cohorts: TrainingCohortService,
    private readonly enrollments: TrainingEnrollmentService,
    private readonly promotions: TrainingPromotionService
  ) {}

  // 'pending-promotions' 는 :id 보다 먼저 선언해야 ParseIntPipe 에 걸리지 않는다.
  @Get('pending-promotions')
  @Permissions('training:read')
  @ApiOperation({
    summary: '놓친 수료 제안',
    description: [
      '수료했는데 아직 과정이 정한 단계 아래에 있거나, 간사 등록 제안을 받지 않은 사람이 있는 기수 목록 (최근 기수 먼저).',
      '넘긴 사람(`POST /training/cohorts/{id}/promotions/dismiss`)은 빠진다. 각 항목은 기수별 제안과 같은 모양이다.',
    ].join('\n'),
  })
  pendingPromotions(@RequireChurch() auth: Auth) {
    return this.promotions.pending(auth.churchId);
  }

  @Get()
  @Permissions('training:read')
  @ApiOperation({
    summary: '기수 목록',
    description: [
      '최근 시작순. 각 기수에 과정 이름·담당자 이름과 함께 **회차 수 / 수강 인원 / 수료 인원**이 붙는다.',
      '',
      '`courseId`·`status`(planned/ongoing/closed) 로 필터 가능.',
    ].join('\n'),
  })
  list(@RequireChurch() auth: Auth, @Query() query: ListCohortQueryDto) {
    return this.cohorts.list(auth.churchId, query);
  }

  @Post()
  @Permissions('training:write')
  @ApiOperation({
    summary: '기수 개설',
    description: [
      '기수를 만들면서 **회차를 함께 생성한다**(한 트랜잭션). 회차 없이 만들면 출석 체크를 할 수 없기 때문.',
      '',
      '- `name` 은 담당자가 직접 적는다 — "5기" 여도 되고 "2026 봄학기" 여도 된다.',
      '  같은 과정 안에서 이름이 겹치면 409. (예전에는 번호를 자동 채번했는데 교회가 쓰는 이름을 담을 수 없었다)',
      '- `sessionCount` 생략 시 과정의 `defaultSessionCount` 를 따른다 (믿음학교 12 등).',
      '- 회차의 날짜·주제는 비워둔 채 생성되며 `PATCH /training/cohorts/sessions/{sessionId}` 로 채운다.',
    ].join('\n'),
  })
  create(@RequireChurch() auth: Auth, @Body() dto: CreateCohortDto) {
    return this.cohorts.create(auth.churchId, dto);
  }

  @Get(':id')
  @Permissions('training:read')
  @ApiOperation({
    summary: '기수 상세 (출석 매트릭스)',
    description: [
      '`{ sessions, roster }` 형태로 **회차 × 수강생 표 하나를 그대로 그릴 수 있게** 반환한다.',
      '',
      '각 수강생에는 출석한 회차 id 목록(`attendedSessionIds`)과 출석률이 포함된다.',
    ].join('\n'),
  })
  detail(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number) {
    return this.enrollments.detail(auth.churchId, id);
  }

  @Patch(':id')
  @Permissions('training:write')
  @ApiOperation({
    summary: '기수 수정',
    description: '일정·담당자·비고와 진행 상태(`status`)를 바꾼다. 회차 수는 여기서 바뀌지 않는다(회차 추가 API 사용).',
  })
  update(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCohortDto) {
    return this.cohorts.update(auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('training:write')
  @HttpCode(204)
  @ApiOperation({ summary: '기수 삭제', description: '회차·수강·출석 기록까지 함께 soft delete 한다.' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number) {
    return this.cohorts.remove(auth.churchId, id);
  }

  @Get(':id/sessions')
  @Permissions('training:read')
  @ApiOperation({ summary: '회차 목록', description: '회차 번호순. 날짜·주제 확인용.' })
  listSessions(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number) {
    return this.cohorts.listSessions(auth.churchId, id);
  }

  @Post(':id/sessions')
  @Permissions('training:write')
  @ApiOperation({ summary: '회차 추가', description: '과정 기본값보다 길게 진행될 때 마지막 번호 다음으로 한 회차를 덧붙인다.' })
  addSession(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number) {
    return this.cohorts.addSession(auth.churchId, id);
  }

  @Patch('sessions/:sessionId')
  @Permissions('training:write')
  @ApiOperation({ summary: '회차 날짜·주제 수정' })
  @ApiParam({ name: 'sessionId', description: '회차 id', type: Number })
  updateSession(@RequireChurch() auth: Auth, @Param('sessionId', ParseIntPipe) sessionId: number, @Body() dto: UpdateSessionDto) {
    return this.cohorts.updateSession(auth.churchId, sessionId, dto);
  }

  @Delete('sessions/:sessionId')
  @Permissions('training:write')
  @HttpCode(204)
  @ApiOperation({
    summary: '회차 삭제',
    description: '그 회차의 출석 기록을 함께 삭제하고, 남은 회차 번호를 1부터 다시 매긴다.',
  })
  @ApiParam({ name: 'sessionId', description: '회차 id', type: Number })
  @ApiNoContentResponse({ description: '삭제 완료' })
  removeSession(@RequireChurch() auth: Auth, @Param('sessionId', ParseIntPipe) sessionId: number) {
    return this.cohorts.removeSession(auth.churchId, sessionId);
  }

  @Post('sessions/:sessionId/attendance')
  @Permissions('training:write')
  @ApiOperation({
    summary: '훈련 출석 체크 / 해제',
    description: '`present: true` 면 출석 기록 생성, `false` 면 삭제. 멱등이므로 같은 요청을 반복해도 안전하다.',
  })
  @ApiParam({ name: 'sessionId', description: '회차 id', type: Number })
  @ApiOkResponse({ schema: { type: 'object', properties: { present: { type: 'boolean' } } } })
  markAttendance(@RequireChurch() auth: Auth, @Param('sessionId', ParseIntPipe) sessionId: number, @Body() dto: MarkTrainingAttendanceDto) {
    return this.enrollments.markAttendance(auth.churchId, sessionId, dto);
  }

  @Post(':id/enrollments')
  @Permissions('training:write')
  @ApiOperation({
    summary: '수강생 등록 (일괄)',
    description: '`memberIds` 로 여러 명을 한 번에 등록한다. 이미 등록됐거나 없는 교인은 건너뛰고 `{ added, skipped }` 를 반환.',
  })
  @ApiOkResponse({ schema: { type: 'object', properties: { added: { type: 'number' }, skipped: { type: 'number' } } } })
  enroll(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number, @Body() dto: EnrollMembersDto) {
    return this.enrollments.enroll(auth.churchId, id, dto);
  }

  @Get(':id/promotions')
  @Permissions('training:read')
  @ApiOperation({
    summary: '수료자 단계 제안',
    description: [
      '이 기수 수료자 중 과정이 정한 단계(`completionStatusId`)보다 **아래에 있는 사람**과,',
      '과정이 간사 등록을 제안하면(`completionSuggestsResident`) 아직 간사가 아닌 수료자를 돌려준다.',
      '',
      '저장된 제안이 아니라 매번 계산한다 — 이미 올렸거나 다른 경로로 올라간 사람은 저절로 빠진다.',
      '**자동으로 바꾸지 않는다.** 반영은 `POST` 로 담당자가 한다.',
    ].join('\n'),
  })
  listPromotions(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number) {
    return this.promotions.forCohort(auth.churchId, id);
  }

  @Post(':id/promotions')
  @Permissions('member:write')
  @ApiOperation({
    summary: '수료자 단계 올리기',
    description: [
      '고른 수료자의 재적상태를 과정이 정한 단계로 바꾸고 단계 이력을 남긴다(시작일 = 수료일, 사유 = "과정 기수 수료").',
      '대상 여부는 서버가 다시 계산해서, 대상이 아닌 사람은 `skipped` 로 센다.',
    ].join('\n'),
  })
  @ApiOkResponse({ schema: { type: 'object', properties: { promoted: { type: 'number' }, skipped: { type: 'number' } } } })
  applyPromotions(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number, @Body() dto: ApplyPromotionDto) {
    return this.promotions.apply(auth.churchId, id, dto.memberIds);
  }

  @Post(':id/promotions/dismiss')
  @Permissions('training:write')
  @ApiOperation({
    summary: '수료 제안 넘기기',
    description: '고른 수료자의 단계·간사 제안을 더는 띄우지 않는다. 수강 기록에 넘긴 날이 남는다.',
  })
  @ApiOkResponse({ schema: { type: 'object', properties: { dismissed: { type: 'number' } } } })
  dismissPromotions(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number, @Body() dto: ApplyPromotionDto) {
    return this.promotions.dismiss(auth.churchId, id, dto.memberIds);
  }

  @Get(':id/next-step-candidates')
  @Permissions('training:read')
  @ApiOperation({
    summary: '다음 STEP 후보',
    description: [
      '이 기수 과정의 바로 앞 STEP 을 수료했는데 이 과정은 아직 듣지 않은 사람 (중도포기는 다시 후보).',
      '과정에 STEP 이 없거나 STEP 1 이면 `previousStep: null`.',
    ].join('\n'),
  })
  nextStepCandidates(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number) {
    return this.promotions.nextStepCandidates(auth.churchId, id);
  }
}
