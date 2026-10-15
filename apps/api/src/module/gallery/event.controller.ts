import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventService } from './event.service';

@ApiTags(SwaggerTag.GALLERY)
@ApiAuth()
@Controller('events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EventController {
  constructor(private readonly events: EventService) {}

  @Get()
  @Permissions('gallery:read')
  @ApiOperation({
    summary: '행사(앨범) 목록',
    description: '갤러리의 앨범 단위. 날짜 내림차순으로 반환하며 각 항목에 사진 수(`photoCount`)가 붙는다. 일정(calendar)과는 별개 개념.',
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.events.list(auth.churchId);
  }

  @Post()
  @Permissions('gallery:write')
  @ApiOperation({
    summary: '행사 생성',
    description: '사진을 담을 앨범을 만든다. 사진 업로드는 `POST /events/{eventId}/photos/presign` 부터.',
  })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: CreateEventDto) {
    return this.events.create(auth.churchId, dto);
  }

  @Patch(':id')
  @Permissions('gallery:write')
  @ApiOperation({ summary: '행사 수정', description: '이름·날짜·설명·정렬순서를 변경한다. 보낸 필드만 반영.' })
  update(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEventDto) {
    return this.events.update(auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('gallery:write')
  @HttpCode(204)
  @ApiOperation({
    summary: '행사 삭제',
    description: '**앨범 안의 사진도 함께 정리된다** — S3 객체 삭제(best-effort) 후 사진 row 를 soft delete 한다.',
  })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.events.remove(auth.churchId, id);
  }
}
