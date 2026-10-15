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
  CreateMissionaryDto,
  CreateNoteDto,
  ListMissionaryQueryDto,
  UpdateMissionaryDto,
  UpdateStageDto,
  UpsertStageDto,
} from './dto/missionary.dto';
import { MissionaryService } from './missionary.service';
import { MissionaryStageService } from './stage.service';

type Auth = AuthContext & { churchId: number };

@ApiTags(SwaggerTag.MISSIONARY)
@ApiAuth()
@Controller('missionaries')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MissionaryController {
  constructor(
    private readonly missionaries: MissionaryService,
    private readonly stages: MissionaryStageService
  ) {}

  // ─── 단계 기준정보 ──────────────────────────────────────────
  // 'stages' 는 :id 보다 먼저 선언해야 라우팅이 겹치지 않는다.

  @Get('stages')
  @Permissions('missionary:read')
  @ApiOperation({
    summary: '선교사 단계 목록',
    description: [
      '파송 절차는 교회마다 다르므로 단계는 **교회별 기준정보**다 (코드에 고정된 enum 이 아니다).',
      '교회 생성 시 후보 / 훈련 중 / 파송 확정 / 현지 사역 / 안식년 / 복귀 / 종료 7종이 시드되며 자유롭게 편집한다.',
      '',
      '`countsAsActive` 가 이 도메인의 유일한 코드 규약이다 — 이 플래그가 켜진 단계에 있는 사람이',
      '대시보드 "현재 파송 인원"에 잡히고, 재적상태가 "파송"으로 전환되어 출석 명단에서 빠진다.',
    ].join('\n'),
  })
  listStages(@RequireChurch() auth: Auth) {
    return this.stages.list(auth.churchId);
  }

  @Post('stages')
  @Permissions('settings:write')
  @ApiOperation({ summary: '선교사 단계 추가', description: '교회의 파송 절차에 맞게 단계를 추가한다.' })
  createStage(@RequireChurch() auth: Auth, @Body() dto: UpsertStageDto) {
    return this.stages.create(auth.churchId, dto);
  }

  @Patch('stages/:stageId')
  @Permissions('settings:write')
  @ApiOperation({ summary: '선교사 단계 수정', description: '이름·설명·정렬순서·활성여부와 파송 집계 포함 여부를 변경한다.' })
  @ApiParam({ name: 'stageId', description: '단계 id', type: Number })
  updateStage(@RequireChurch() auth: Auth, @Param('stageId', ParseIntPipe) stageId: number, @Body() dto: UpdateStageDto) {
    return this.stages.update(auth.churchId, stageId, dto);
  }

  @Delete('stages/:stageId')
  @Permissions('settings:write')
  @HttpCode(204)
  @ApiOperation({
    summary: '선교사 단계 삭제',
    description: '선교사나 기록에서 쓰이는 단계는 409. 지우면 기록의 단계 표시가 끊기므로 비활성화를 유도한다.',
  })
  @ApiParam({ name: 'stageId', description: '단계 id', type: Number })
  @ApiNoContentResponse({ description: '삭제 완료' })
  @ApiConflictResponse({ description: '사용 중인 단계 — 비활성화를 사용할 것' })
  removeStage(@RequireChurch() auth: Auth, @Param('stageId', ParseIntPipe) stageId: number) {
    return this.stages.remove(auth.churchId, stageId);
  }

  // ─── 선교사 ────────────────────────────────────────────────

  @Get()
  @Permissions('missionary:read')
  @ApiOperation({
    summary: '선교사 목록',
    description: [
      '교인 이름·단계 이름·소속 사역팀이 붙은 파송 트랙 목록.',
      '',
      '- `stageId`: 특정 단계만',
      '- `scope=active`: `countsAsActive` 단계에 있는 사람만 (대시보드 "현재 파송"과 같은 기준)',
    ].join('\n'),
  })
  list(@RequireChurch() auth: Auth, @Query() query: ListMissionaryQueryDto) {
    return this.missionaries.list(auth.churchId, query);
  }

  @Get('summary')
  @Permissions('missionary:read')
  @ApiOperation({
    summary: '파송 현황 요약',
    description: '`{ active, commissionedThisYear, byStage }`. `byStage` 는 교회가 정의한 단계 순서대로이며 단계 미지정 인원도 포함한다.',
  })
  summary(@RequireChurch() auth: Auth) {
    return this.missionaries.summary(auth.churchId);
  }

  @Get('by-member/:memberId')
  @Permissions('missionary:read')
  @ApiOperation({ summary: '교인의 파송 프로필 조회', description: '교인 상세 화면용. 트랙에 없으면 `null` (404 아님).' })
  @ApiParam({ name: 'memberId', description: '교인 id', type: Number })
  byMember(@RequireChurch() auth: Auth, @Param('memberId', ParseIntPipe) memberId: number) {
    return this.missionaries.findByMember(auth.churchId, memberId);
  }

  @Get(':id')
  @Permissions('missionary:read')
  @ApiOperation({ summary: '선교사 상세', description: '프로필 + 기록(`notes`) 최신순. 각 기록에 메모·단계(선택)·작성자가 담긴다.' })
  detail(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number) {
    return this.missionaries.detail(auth.churchId, id);
  }

  @Post()
  @Permissions('missionary:write')
  @ApiOperation({
    summary: '파송 트랙 등록',
    description: [
      '두 가지 방식 중 하나로 등록한다. 둘을 함께 보내면 400.',
      '',
      '- `memberId`: 이미 명부에 있는 교인',
      '- `newMember: { name, phone? }`: **명부에 없는 사람** — 교인을 함께 만든다',
      '  (교인 화면에서 먼저 등록하고 돌아오지 않아도 되게)',
      '',
      '`stageId` 는 선택이며 생략하면 단계 미지정으로 시작한다.',
      '파송 집계(`countsAsActive`) 단계로 시작하면 파송 확정일과 재적상태가 함께 맞춰진다.',
    ].join('\n'),
  })
  @ApiBadRequestResponse({ description: 'memberId·newMember 둘 다 없음 또는 둘 다 있음' })
  @ApiConflictResponse({ description: '이미 파송 트랙에 등록된 교인' })
  create(@RequireChurch() auth: Auth, @Body() dto: CreateMissionaryDto) {
    return this.missionaries.create(auth.churchId, auth.accountId, dto);
  }

  @Patch(':id')
  @Permissions('missionary:write')
  @ApiOperation({
    summary: '선교사 정보 수정',
    description: [
      '파송지·사역 내용·날짜·비고를 수정한다. **현재 단계(`stageId`)도 여기서 바꿀 수 있다** — 기록을 남기지 않는 단순 정정용.',
      '',
      '경과를 남기면서 단계를 옮기려면 `POST /missionaries/{id}/notes` 를 쓴다.',
    ].join('\n'),
  })
  update(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMissionaryDto) {
    return this.missionaries.update(auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('missionary:write')
  @HttpCode(204)
  @ApiOperation({ summary: '파송 트랙에서 제거', description: '잘못 등록한 경우에만. 기록도 함께 정리된다. 교인 자체는 남는다.' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number) {
    return this.missionaries.remove(auth.churchId, id);
  }

  // ─── 기록(메모) ────────────────────────────────────────────

  @Get(':id/notes')
  @Permissions('missionary:read')
  @ApiOperation({ summary: '기록 목록', description: '최신순. 단계가 지정된 기록은 그 시점의 단계 이름이 함께 온다.' })
  listNotes(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number) {
    return this.missionaries.listNotes(auth.churchId, id);
  }

  @Post(':id/notes')
  @Permissions('missionary:write')
  @ApiOperation({
    summary: '기록 추가 (메모 + 단계 선택)',
    description: [
      '**메모가 본체이고 단계는 선택 항목이다.** 단계를 비워두면 경과 메모만 남는다.',
      '',
      '`stageId` 를 지정하면 프로필의 현재 단계도 그 값으로 갱신된다 — 단계 이동과 그 사유를 한 번에 기록하는 형태.',
      '파송 집계 단계로 처음 들어가면 파송 확정일이 비어 있을 때 기록일로 채워지고, 교인 재적상태가 "파송"이 된다.',
    ].join('\n'),
  })
  addNote(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateNoteDto) {
    return this.missionaries.addNote(auth.churchId, id, auth.accountId, dto);
  }

  @Delete(':id/notes/:noteId')
  @Permissions('missionary:write')
  @HttpCode(204)
  @ApiOperation({
    summary: '기록 삭제',
    description: '잘못 남긴 기록을 지운다. **프로필의 현재 단계는 바뀌지 않는다** — 필요하면 별도로 정정할 것.',
  })
  @ApiParam({ name: 'noteId', description: '기록 id', type: Number })
  @ApiNoContentResponse({ description: '삭제 완료' })
  removeNote(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number, @Param('noteId', ParseIntPipe) noteId: number) {
    return this.missionaries.removeNote(auth.churchId, id, noteId);
  }
}
