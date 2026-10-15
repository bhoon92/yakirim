import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { CareNoteTemplateService } from './care-note-template.service';
import { CreateCareNoteTemplateDto } from './dto/care-note-template.dto';

@ApiTags(SwaggerTag.MEMBER)
@ApiAuth()
@Controller('care-note-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CareNoteTemplateController {
  constructor(private readonly templates: CareNoteTemplateService) {}

  @Get()
  @Permissions('care:read')
  @ApiOperation({ summary: '심방 기록 양식 목록', description: '새 기록에 채울 틀. 교회 전체가 함께 쓴다.' })
  list(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.templates.list(auth.churchId);
  }

  @Post()
  @Permissions('care:write')
  @ApiOperation({ summary: '양식 저장', description: '같은 이름이면 409. typeId 를 주면 그 기록 종류가 함께 골라진다.' })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: CreateCareNoteTemplateDto) {
    return this.templates.create(auth.churchId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions('care:write')
  @ApiOperation({ summary: '양식 삭제', description: '이미 쓴 기록에는 영향이 없다.' })
  @ApiNoContentResponse()
  async remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    await this.templates.remove(auth.churchId, id);
  }
}
