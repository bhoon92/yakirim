import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { CalendarService } from './calendar.service';
import { CreateCalendarDto, UpdateCalendarDto } from './dto/calendar.dto';

@ApiTags(SwaggerTag.CALENDAR)
@ApiAuth()
@Controller('calendar/calendars')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CalendarController {
  constructor(private readonly calendars: CalendarService) {}

  @Get()
  @Permissions('calendar:read')
  @ApiOperation({
    summary: '캘린더(분류) 목록',
    description: '일정을 묶는 레이어. "전체 교회", "청년부" 처럼 색(`color`)으로 구분하며, 일정 생성 시 `calendarId` 로 지정한다.',
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.calendars.list(auth.churchId);
  }

  @Post()
  @Permissions('calendar:write')
  @ApiOperation({ summary: '캘린더 생성', description: '이름과 색을 정한다. 구독 설정에서 캘린더 단위로 켜고 끌 수 있다.' })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: CreateCalendarDto) {
    return this.calendars.create(auth.churchId, dto);
  }

  @Patch(':id')
  @Permissions('calendar:write')
  @ApiOperation({ summary: '캘린더 수정', description: '이름·색·정렬순서·활성여부를 변경한다. 보낸 필드만 반영.' })
  update(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCalendarDto) {
    return this.calendars.update(auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('calendar:write')
  @HttpCode(204)
  @ApiOperation({ summary: '캘린더 삭제', description: '이 캘린더에 속한 일정이 있으면 먼저 정리하거나 옮겨야 한다.' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.calendars.remove(auth.churchId, id);
  }
}
