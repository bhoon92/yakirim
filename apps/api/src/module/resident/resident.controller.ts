import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import {
  CreateResidentDto,
  ListResidentQueryDto,
  ResidentDutyNameDto,
  UpdateResidentDto,
  UpdateResidentStatusDto,
  UpsertResidentStatusDto,
} from './dto/resident.dto';
import { ResidentDutyService } from './resident-duty.service';
import { ResidentStatusService } from './resident-status.service';
import { ResidentService } from './resident.service';

type Auth = AuthContext & { churchId: number };

@ApiTags(SwaggerTag.RESIDENT)
@ApiAuth()
@Controller('residents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ResidentController {
  constructor(
    private readonly residents: ResidentService,
    private readonly statuses: ResidentStatusService,
    private readonly duties: ResidentDutyService
  ) {}

  // ─── 상태 기준정보 ──────────────────────────────────────────
  // 'statuses' 는 :id 보다 먼저 선언해야 라우팅이 겹치지 않는다.

  @Get('statuses')
  @Permissions('resident:read')
  @ApiOperation({
    summary: '간사 상태 목록',
    description: [
      '교회 생성 시 활동 / 안식 / 퇴소 3종이 시드되며 자유롭게 편집한다.',
      '',
      '`countsAsActive` 가 이 도메인의 유일한 코드 규약이다 — 이 플래그가 켜진 상태에 있는 사람이',
      '"지금 공동체에 있는 간사"로 집계되고, 여기서 벗어날 때 퇴소일이 비어 있으면 자동으로 채워진다.',
    ].join('\n'),
  })
  listStatuses(@RequireChurch() auth: Auth) {
    return this.statuses.list(auth.churchId);
  }

  @Post('statuses')
  @Permissions('settings:write')
  @ApiOperation({ summary: '간사 상태 추가' })
  createStatus(@RequireChurch() auth: Auth, @Body() dto: UpsertResidentStatusDto) {
    return this.statuses.create(auth.churchId, dto);
  }

  @Patch('statuses/:statusId')
  @Permissions('settings:write')
  @ApiOperation({ summary: '간사 상태 수정', description: '이름·설명·정렬순서·활성여부와 공동체 집계 포함 여부를 변경한다.' })
  @ApiParam({ name: 'statusId', description: '상태 id', type: Number })
  updateStatus(@RequireChurch() auth: Auth, @Param('statusId', ParseIntPipe) statusId: number, @Body() dto: UpdateResidentStatusDto) {
    return this.statuses.update(auth.churchId, statusId, dto);
  }

  @Delete('statuses/:statusId')
  @Permissions('settings:write')
  @HttpCode(204)
  @ApiOperation({ summary: '간사 상태 삭제', description: '간사나 이력에서 쓰이는 상태는 409. 비활성화를 유도한다.' })
  @ApiParam({ name: 'statusId', description: '상태 id', type: Number })
  @ApiNoContentResponse({ description: '삭제 완료' })
  @ApiConflictResponse({ description: '사용 중인 상태 — 비활성화를 사용할 것' })
  removeStatus(@RequireChurch() auth: Auth, @Param('statusId', ParseIntPipe) statusId: number) {
    return this.statuses.remove(auth.churchId, statusId);
  }

  // ─── 맡은 사역 옵션 ────────────────────────────────────────
  // 노션 다중 선택의 옵션처럼 다룬다 — 만들기는 간사에게 붙일 때 이름으로, 고치기·지우기는 여기서.

  @Get('duties')
  @Permissions('resident:read')
  @ApiOperation({
    summary: '맡은 사역 옵션 목록',
    description: '교회에서 쓰는 사역 태그 전체. `assignedCount` 는 지금 그 사역을 맡은 간사 수 (지울 때 확인용).',
  })
  listDuties(@RequireChurch() auth: Auth) {
    return this.duties.list(auth.churchId);
  }

  @Patch('duties/:dutyId')
  @Permissions('resident:write')
  @ApiOperation({ summary: '맡은 사역 이름 변경', description: '붙어 있는 모든 간사에게 바뀐 이름이 보인다. 같은 이름이 있으면 409.' })
  @ApiParam({ name: 'dutyId', description: '사역 id', type: Number })
  @ApiConflictResponse({ description: '같은 이름의 사역이 이미 있음' })
  renameDuty(@RequireChurch() auth: Auth, @Param('dutyId', ParseIntPipe) dutyId: number, @Body() dto: ResidentDutyNameDto) {
    return this.duties.rename(auth.churchId, dutyId, dto.name);
  }

  @Delete('duties/:dutyId')
  @Permissions('resident:write')
  @HttpCode(204)
  @ApiOperation({ summary: '맡은 사역 삭제', description: '노션처럼 **붙어 있던 모든 간사에게서 함께 빠진다.**' })
  @ApiParam({ name: 'dutyId', description: '사역 id', type: Number })
  @ApiNoContentResponse({ description: '삭제 완료' })
  removeDuty(@RequireChurch() auth: Auth, @Param('dutyId', ParseIntPipe) dutyId: number) {
    return this.duties.remove(auth.churchId, dutyId);
  }

  // ─── 간사 ──────────────────────────────────────────────────

  @Get()
  @Permissions('resident:read')
  @ApiOperation({
    summary: '간사 목록',
    description: [
      '이름순. 각 행에 하우스(공동체)·사역팀·사역 역할과 과정별 훈련 진행 상태가 붙는다.',
      '하우스·사역팀·역할은 교인의 현재 소속·사역 역할을 그대로 읽은 것이다.',
      '',
      '- `statusId`: 특정 상태만',
      '- `scope=active`: `countsAsActive` 상태에 있는 사람만 (지금 공동체에 있는 간사)',
    ].join('\n'),
  })
  list(@RequireChurch() auth: Auth, @Query() query: ListResidentQueryDto) {
    return this.residents.list(auth.churchId, query);
  }

  @Get('summary')
  @Permissions('resident:read')
  @ApiOperation({ summary: '간사 현황 요약', description: '`{ active, byStatus }`. 상태 미지정 인원도 포함한다.' })
  summary(@RequireChurch() auth: Auth) {
    return this.residents.summary(auth.churchId);
  }

  @Get('by-member/:memberId')
  @Permissions('resident:read')
  @ApiOperation({ summary: '교인의 간사 프로필 조회', description: '간사가 아니면 `null` (404 아님).' })
  @ApiParam({ name: 'memberId', description: '교인 id', type: Number })
  byMember(@RequireChurch() auth: Auth, @Param('memberId', ParseIntPipe) memberId: number) {
    return this.residents.findByMember(auth.churchId, memberId);
  }

  @Get(':id')
  @Permissions('resident:read')
  @ApiOperation({ summary: '간사 상세', description: '프로필 + 상태 이력(`history`) 최신순.' })
  detail(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number) {
    return this.residents.detail(auth.churchId, id);
  }

  @Post()
  @Permissions('resident:write')
  @ApiOperation({
    summary: '간사 등록',
    description: [
      '두 가지 방식 중 하나로 등록한다. 둘을 함께 보내면 400.',
      '',
      '- `memberId`: 이미 명부에 있는 교인',
      '- `newMember: { name, phone? }`: 명부에 없는 사람 — 교인을 함께 만든다',
      '',
      '`statusId` 를 주면 상태 이력 첫 줄이 입주일(없으면 오늘)로 남는다.',
    ].join('\n'),
  })
  @ApiBadRequestResponse({ description: 'memberId·newMember 둘 다 없음 또는 둘 다 있음' })
  @ApiConflictResponse({ description: '이미 간사로 등록된 교인' })
  create(@RequireChurch() auth: Auth, @Body() dto: CreateResidentDto) {
    return this.residents.create(auth.churchId, auth.accountId, dto);
  }

  @Patch(':id')
  @Permissions('resident:write')
  @ApiOperation({
    summary: '간사 정보 수정',
    description: [
      '입주일·헌신 시작일·퇴소일·비고와 현재 상태를 수정한다.',
      '',
      '`statusId` 가 바뀌면 상태 이력이 한 줄 쌓인다 (`statusReason`, `statusDate` 선택).',
      '공동체 집계 상태에서 벗어나는데 퇴소일이 비어 있으면 변경일로 채운다.',
    ].join('\n'),
  })
  update(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateResidentDto) {
    return this.residents.update(auth.churchId, id, auth.accountId, dto);
  }

  @Delete(':id')
  @Permissions('resident:write')
  @HttpCode(204)
  @ApiOperation({ summary: '간사에서 제거', description: '잘못 등록한 경우에만. 상태 이력도 함께 정리된다. 교인 자체는 남는다.' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number) {
    return this.residents.remove(auth.churchId, id);
  }

  @Post(':id/duties')
  @Permissions('resident:write')
  @ApiOperation({
    summary: '맡은 사역 붙이기',
    description: '이름으로 붙인다. **없는 이름이면 옵션이 그 자리에서 만들어진다.** 이미 맡고 있으면 그대로 둔다.',
  })
  assignDuty(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number, @Body() dto: ResidentDutyNameDto) {
    return this.duties.assign(auth.churchId, id, dto.name);
  }

  @Delete(':id/duties/:dutyId')
  @Permissions('resident:write')
  @HttpCode(204)
  @ApiOperation({ summary: '맡은 사역 떼기', description: '맡았던 기간은 남는다(soft delete). 옵션 자체는 지우지 않는다.' })
  @ApiParam({ name: 'dutyId', description: '사역 id', type: Number })
  @ApiNoContentResponse({ description: '떼기 완료' })
  unassignDuty(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number, @Param('dutyId', ParseIntPipe) dutyId: number) {
    return this.duties.unassign(auth.churchId, id, dutyId);
  }

  @Delete(':id/history/:historyId')
  @Permissions('resident:write')
  @HttpCode(204)
  @ApiOperation({ summary: '상태 이력 삭제', description: '잘못 남긴 이력을 지운다. **현재 상태는 바뀌지 않는다.**' })
  @ApiParam({ name: 'historyId', description: '이력 id', type: Number })
  @ApiNoContentResponse({ description: '삭제 완료' })
  removeHistory(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number, @Param('historyId', ParseIntPipe) historyId: number) {
    return this.residents.removeHistory(auth.churchId, id, historyId);
  }
}
