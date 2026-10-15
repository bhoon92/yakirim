import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { CreateMemberViewDto } from './dto/member-view.dto';
import { MemberViewService } from './member-view.service';

@ApiTags(SwaggerTag.MEMBER)
@ApiAuth()
@Controller('member-views')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MemberViewController {
  constructor(private readonly views: MemberViewService) {}

  @Get()
  @Permissions('member:read')
  @ApiOperation({ summary: '저장된 보기 목록', description: '교인 명부의 저장된 필터 묶음. 교회 전체가 함께 쓴다.' })
  list(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.views.list(auth.churchId);
  }

  @Post()
  @Permissions('member:write')
  @ApiOperation({
    summary: '보기 저장',
    description: '`filters` 는 `GET /members` 의 필터와 같은 이름(q·statusId·affiliationKind/Id·stalled·shepherd). 같은 이름이면 409.',
  })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: CreateMemberViewDto) {
    return this.views.create(auth.churchId, auth.accountId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions('member:write')
  @ApiOperation({ summary: '보기 삭제' })
  @ApiNoContentResponse()
  async remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    await this.views.remove(auth.churchId, id);
  }
}
