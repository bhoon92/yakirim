import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { CareNoteService } from './care-note.service';
import { CreateCareNoteDto } from './dto/create-care-note.dto';
import { UpdateCareNoteDto } from './dto/update-care-note.dto';

@ApiTags(SwaggerTag.CARE_NOTE)
@ApiAuth()
@ApiParam({ name: 'memberId', description: '교인 id', type: Number })
@Controller('members/:memberId/care-notes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CareNoteController {
  constructor(private readonly notes: CareNoteService) {}

  @Get()
  @Permissions('care:read')
  @ApiOperation({
    summary: '양육기록 목록',
    description: [
      '해당 교인의 심방·면담·양육·상담·파송보고 기록을 최신순으로 반환한다. 작성자 이름이 함께 온다.',
      '',
      '**민감 정보**라 viewer 역할은 읽기조차 불가(shepherd 이상).',
    ].join('\n'),
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('memberId', ParseIntPipe) memberId: number) {
    return this.notes.listForMember(auth.churchId, memberId);
  }

  @Get('mentions')
  @Permissions('care:read')
  @ApiOperation({
    summary: '이 교인이 언급된 기록',
    description: '다른 교인의 양육기록 본문에서 @ 로 이 교인을 언급한 것들 (노션의 백링크). 기록 대상 이름이 함께 온다.',
  })
  mentions(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('memberId', ParseIntPipe) memberId: number) {
    return this.notes.listMentioning(auth.churchId, memberId);
  }

  @Post()
  @Permissions('care:write')
  @ApiOperation({
    summary: '양육기록 작성',
    description: '작성자는 토큰의 계정으로 자동 기록된다. `type` 생략 시 면담(meeting), `date` 생략 시 오늘.',
  })
  create(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: CreateCareNoteDto
  ) {
    return this.notes.create(auth.churchId, memberId, auth.accountId, dto);
  }

  @Patch(':id')
  @Permissions('care:write')
  @ApiOperation({ summary: '양육기록 수정', description: '보낸 필드만 갱신한다.' })
  @ApiParam({ name: 'id', description: '양육기록 id', type: Number })
  update(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('memberId', ParseIntPipe) memberId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCareNoteDto
  ) {
    return this.notes.update(auth.churchId, memberId, id, dto);
  }

  @Delete(':id')
  @Permissions('care:write')
  @HttpCode(204)
  @ApiOperation({ summary: '양육기록 삭제' })
  @ApiParam({ name: 'id', description: '양육기록 id', type: Number })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('memberId', ParseIntPipe) memberId: number,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.notes.remove(auth.churchId, memberId, id);
  }
}
