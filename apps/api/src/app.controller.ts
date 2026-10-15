import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTag } from './common/swagger/swagger-tags';
import { AppService } from './app.service';

@ApiTags(SwaggerTag.SYSTEM)
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: '루트 인사말', description: '서버가 떠 있는지 눈으로 확인하는 용도. 인증 없음.' })
  @ApiOkResponse({ description: '고정 문자열', schema: { type: 'string', example: 'Hello World!' } })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: '헬스체크',
    description: 'Railway 등 플랫폼의 상태 점검용. DB 접속까지 확인하지는 않고 프로세스 생존만 알려준다.',
  })
  @ApiOkResponse({ schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } })
  health(): { status: string } {
    return { status: 'ok' };
  }
}
