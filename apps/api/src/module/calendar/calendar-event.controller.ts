import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { CalendarEventService } from './calendar-event.service';
import { CreateCalendarEventDto, ListEventQueryDto, UpdateCalendarEventDto } from './dto/calendar-event.dto';

const GOOGLE_PUSH_NOTE = '구글 캘린더를 연동한 계정이 있으면 변경분이 **비동기 best-effort 로 push** 된다(실패해도 이 응답은 성공).';

@ApiTags(SwaggerTag.CALENDAR)
@ApiAuth()
@Controller('calendar/events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CalendarEventController {
  constructor(private readonly events: CalendarEventService) {}

  @Get()
  @Permissions('calendar:read')
  @ApiOperation({
    summary: '일정 조회 (기간)',
    description: [
      '`from`~`to` 구간(ISO8601)의 일정을 시간순으로 반환한다. 달력 화면이 보이는 범위만 요청하는 용도.',
      '',
      '**반복 일정은 각 발생분(occurrence)으로 펼쳐서** 내려간다 — 같은 `id` 가 서로 다른 `startAt` 으로 여러 번 나올 수 있다.',
      '반복 규칙은 `daily` / `weekly` / `biweekly` / `monthly` / `yearly` 5종.',
    ].join('\n'),
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }, @Query() query: ListEventQueryDto) {
    return this.events.list(auth.churchId, query.from, query.to);
  }

  @Post()
  @Permissions('calendar:write')
  @ApiOperation({
    summary: '일정 생성',
    description: [
      '`calendarId` 로 소속 캘린더를 지정한다(없는 캘린더면 404). `allDay: true` 면 시간은 무시된다.',
      '`recurrence` 를 주면 반복 일정이 되고, 하나의 row 로 저장한 뒤 조회 시 펼쳐진다.',
      '',
      GOOGLE_PUSH_NOTE,
    ].join('\n'),
  })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: CreateCalendarEventDto) {
    return this.events.create(auth.churchId, dto);
  }

  @Patch(':id')
  @Permissions('calendar:write')
  @ApiOperation({
    summary: '일정 수정',
    description: `보낸 필드만 갱신한다. 반복 일정을 수정하면 **모든 발생분이 함께 바뀐다**(단일 발생분만 수정하는 기능은 없음).\n\n${GOOGLE_PUSH_NOTE}`,
  })
  update(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCalendarEventDto
  ) {
    return this.events.update(auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('calendar:write')
  @HttpCode(204)
  @ApiOperation({ summary: '일정 삭제', description: `반복 일정이면 전체가 삭제된다.\n\n${GOOGLE_PUSH_NOTE}` })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.events.remove(auth.churchId, id);
  }
}
