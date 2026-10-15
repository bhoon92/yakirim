import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { FeedService } from './feed.service';

/**
 * 공개 iCal 피드 — 캘린더 앱(구글/애플)이 쿠키 없이 토큰 URL 로 구독.
 * JwtAuthGuard 없음 (토큰이 곧 인증). 경로는 단축 위해 '/c/:token'.
 */
@ApiTags(SwaggerTag.CALENDAR)
@Controller('c')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get(':token')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @ApiOperation({
    summary: 'iCal 피드 (공개 · 인증 없음)',
    description: [
      '구독 토큰으로 iCal(.ics) 본문을 반환한다. **가드가 없다** — 토큰 자체가 인증이므로 캘린더 앱이 쿠키 없이 읽어갈 수 있다.',
      '',
      '- 토큰은 `GET /calendar/subscription` 에서 발급되며, 구독 설정에 포함된 캘린더의 일정만 담긴다.',
      '- 경로 끝의 `.ics` 는 붙여도 되고 없어도 된다(캘린더 앱 호환용).',
      '- 반복 일정은 펼치지 않고 RRULE 로 내려가 앱이 직접 전개한다.',
    ].join('\n'),
  })
  @ApiParam({ name: 'token', description: '구독 피드 토큰 (`.ics` 접미사 허용)', example: 'abc123.ics' })
  @ApiProduces('text/calendar')
  @ApiOkResponse({ description: 'iCal 본문', schema: { type: 'string', example: 'BEGIN:VCALENDAR...' } })
  async ics(@Param('token') token: string, @Res() res: Response) {
    const clean = token.replace(/\.ics$/i, '');
    const body = await this.feed.buildIcs(clean);
    res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"');
    res.send(body);
  }
}
