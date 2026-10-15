import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { RosterQueryDto } from './dto/roster-query.dto';

@ApiTags(SwaggerTag.ATTENDANCE)
@ApiAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  /** 예배·날짜별 출석 명단 + 출석률. */
  @Get('roster')
  @Permissions('attendance:read')
  @ApiOperation({
    summary: '출석 명단 조회 (예배 × 날짜)',
    description: [
      '해당 예배·날짜의 체크용 명단을 이름순으로 반환한다. 각 항목에 `present` 가 들어있어 그대로 체크박스 목록이 된다.',
      '',
      '- 재적상태가 `countsInRoster: false` 인 교인(별세·이명 등)은 명단에서 제외된다.',
      '- 응답에 출석 인원(present)과 전체(total), 출석률이 함께 포함된다.',
    ].join('\n'),
  })
  roster(@RequireChurch() auth: AuthContext & { churchId: number }, @Query() query: RosterQueryDto) {
    return this.attendance.roster(auth.churchId, query.worshipServiceId, query.date);
  }

  /** 출석 체크 토글. */
  @Post('mark')
  @Permissions('attendance:write')
  @ApiOperation({
    summary: '출석 체크 / 체크 해제',
    description: [
      '`present: true` 면 출석 기록을 만들고(이미 있으면 그대로), `false` 면 기록을 soft delete 한다.',
      '멱등이므로 같은 요청을 여러 번 보내도 안전하다.',
    ].join('\n'),
  })
  @ApiOkResponse({ schema: { type: 'object', properties: { present: { type: 'boolean' } } } })
  mark(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: MarkAttendanceDto) {
    return this.attendance.mark(auth.churchId, dto);
  }
}
