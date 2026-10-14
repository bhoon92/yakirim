import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { AssignFlockDto, SetShepherdDto } from './dto/shepherd.dto';
import { ShepherdService } from './shepherd.service';

type Auth = AuthContext & { churchId: number };

@ApiTags(SwaggerTag.RESIDENT)
@ApiAuth()
@Controller('shepherds')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ShepherdController {
  constructor(private readonly shepherds: ShepherdService) {}

  @Get('members/:memberId')
  @Permissions('member:read')
  @ApiOperation({ summary: '성도의 담당 간사', description: '`{ current, history }`. 담당이 없으면 `current: null`. 이력은 최근 먼저.' })
  @ApiParam({ name: 'memberId', description: '교인 id', type: Number })
  forMember(@RequireChurch() auth: Auth, @Param('memberId', ParseIntPipe) memberId: number) {
    return this.shepherds.forMember(auth.churchId, memberId);
  }

  @Put('members/:memberId')
  @Permissions('member:write')
  @ApiOperation({
    summary: '담당 간사 지정·변경·해제',
    description: '한 성도에 담당은 한 명이다. 바꾸면 이전 담당 구간이 닫히고 새 구간이 열린다. `residentId: null` 이면 해제.',
  })
  @ApiParam({ name: 'memberId', description: '교인 id', type: Number })
  @ApiOkResponse({ schema: { type: 'object', properties: { changed: { type: 'number' } } } })
  setForMember(@RequireChurch() auth: Auth, @Param('memberId', ParseIntPipe) memberId: number, @Body() dto: SetShepherdDto) {
    return this.shepherds.assign(auth.churchId, [memberId], dto.residentId, dto.date);
  }

  @Get('residents/:residentId')
  @Permissions('member:read')
  @ApiOperation({
    summary: '간사가 맡은 성도',
    description: '지금 맡은 성도와 마지막 양육기록 날짜. **연락한 지 오래된 사람이 위로** 온다 (기록이 없으면 담당 시작일 기준).',
  })
  @ApiParam({ name: 'residentId', description: '간사 id', type: Number })
  flock(@RequireChurch() auth: Auth, @Param('residentId', ParseIntPipe) residentId: number) {
    return this.shepherds.flock(auth.churchId, residentId);
  }

  @Post('residents/:residentId')
  @Permissions('member:write')
  @ApiOperation({ summary: '간사에게 성도 맡기기', description: '여러 명을 한 번에. 다른 간사 담당이던 사람은 이 간사로 옮겨온다.' })
  @ApiParam({ name: 'residentId', description: '간사 id', type: Number })
  @ApiOkResponse({ schema: { type: 'object', properties: { changed: { type: 'number' } } } })
  assignFlock(@RequireChurch() auth: Auth, @Param('residentId', ParseIntPipe) residentId: number, @Body() dto: AssignFlockDto) {
    return this.shepherds.assign(auth.churchId, dto.memberIds, residentId);
  }
}
