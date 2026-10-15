import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { CalendarSubscriptionEntity } from '@src/database/entities/calendar-subscription.entity';
import { UpdateSubscriptionDto } from './dto/subscription.dto';
import { SubscriptionService } from './subscription.service';

const SUBSCRIPTION_RESPONSE = {
  schema: {
    type: 'object',
    properties: {
      feedToken: { type: 'string', description: '피드 URL 에 들어가는 비밀 토큰' },
      calendarIds: { type: 'array', items: { type: 'number' }, description: '피드에 포함할 캘린더 id 목록' },
      feedPath: { type: 'string', example: '/api/c/abc123.ics', description: '캘린더 앱에 등록할 구독 경로' },
    },
  },
} as const;

@ApiTags(SwaggerTag.CALENDAR)
@ApiAuth()
@Controller('calendar/subscription')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get()
  @ApiOperation({
    summary: '내 iCal 구독 정보',
    description: [
      '로그인한 계정의 구독 설정을 반환한다. **없으면 이 호출에서 생성**되므로 항상 값이 있다(GET 이지만 최초 1회 쓰기 발생).',
      '',
      '`feedPath` 를 구글/애플 캘린더의 "URL 로 구독"에 넣으면 교회 일정이 따라간다. 토큰이 곧 인증이니 링크 공유에 주의.',
    ].join('\n'),
  })
  @ApiOkResponse(SUBSCRIPTION_RESPONSE)
  async mine(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.toResponse(await this.subscriptions.getOrCreate(auth.churchId, auth.accountId));
  }

  @Put()
  @ApiOperation({
    summary: '구독 대상 캘린더 변경',
    description: '피드에 포함할 캘린더 id 목록을 **통째로 교체**한다(부분 수정이 아님). 토큰은 그대로 유지된다.',
  })
  @ApiOkResponse(SUBSCRIPTION_RESPONSE)
  async update(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: UpdateSubscriptionDto) {
    return this.toResponse(await this.subscriptions.update(auth.churchId, auth.accountId, dto.calendarIds));
  }

  @Post('regenerate')
  @ApiOperation({
    summary: '피드 토큰 재발급',
    description: '토큰이 유출됐을 때 사용. 새 토큰이 발급되고 **기존 피드 URL 은 즉시 무효**가 되므로 캘린더 앱에 다시 등록해야 한다.',
  })
  @ApiOkResponse(SUBSCRIPTION_RESPONSE)
  async regenerate(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.toResponse(await this.subscriptions.regenerate(auth.churchId, auth.accountId));
  }

  private toResponse(sub: CalendarSubscriptionEntity) {
    return {
      feedToken: sub.feedToken,
      calendarIds: sub.calendarIds,
      feedPath: `/api/c/${sub.feedToken}.ics`,
    };
  }
}
