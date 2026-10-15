import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { ConfirmPhotoDto, PresignPhotoDto } from './dto/photo.dto';
import { PhotoService } from './photo.service';

@ApiTags(SwaggerTag.GALLERY)
@ApiAuth()
@ApiParam({ name: 'eventId', description: '행사(앨범) id', type: Number })
@Controller('events/:eventId/photos')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PhotoController {
  constructor(private readonly photos: PhotoService) {}

  @Get()
  @Permissions('gallery:read')
  @ApiOperation({
    summary: '사진 목록',
    description: [
      '앨범의 사진을 정렬순서대로 반환한다. `url` 은 **조회용 presigned URL** 이라 만료되므로 캐시하지 말고 매번 목록을 다시 받는 편이 좋다.',
    ].join('\n'),
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('eventId', ParseIntPipe) eventId: number) {
    return this.photos.listForEvent(auth.churchId, eventId);
  }

  /** 1단계: 업로드용 presigned URL 발급. */
  @Post('presign')
  @Permissions('gallery:write')
  @ApiOperation({
    summary: '[업로드 1단계] presigned URL 발급',
    description: [
      '파일 이름을 주면 S3 객체 key 와 업로드용 URL(`uploadUrl`)을 돌려준다.',
      '',
      '브라우저는 이 URL 로 **파일을 직접 PUT** 하고(서버를 거치지 않음), 성공 후 2단계(`POST /events/{eventId}/photos`)로 확정한다.',
    ].join('\n'),
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        key: { type: 'string', example: 'church/1/event/3/1712345678-photo.jpg' },
        uploadUrl: { type: 'string', description: 'S3 PUT 용 presigned URL (만료됨)' },
      },
    },
  })
  presign(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: PresignPhotoDto
  ) {
    return this.photos.presign(auth.churchId, eventId, dto);
  }

  /** 2단계: S3 업로드 완료 후 메타데이터 확정. */
  @Post()
  @Permissions('gallery:write')
  @ApiOperation({
    summary: '[업로드 2단계] 사진 등록 확정',
    description: [
      'S3 PUT 이 끝난 뒤 1단계에서 받은 `key` 를 그대로 보내 사진 row 를 만든다. 업로더는 토큰의 계정으로 기록된다.',
      '',
      '`key` 가 `church/{churchId}/event/{eventId}/` 로 시작하지 않으면 400 (다른 교회/행사로의 끼워넣기 방지).',
    ].join('\n'),
  })
  @ApiBadRequestResponse({ description: '잘못된 업로드 key' })
  confirm(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: ConfirmPhotoDto
  ) {
    return this.photos.confirm(auth.churchId, eventId, auth.accountId, dto);
  }

  @Delete(':photoId')
  @Permissions('gallery:write')
  @HttpCode(204)
  @ApiOperation({ summary: '사진 삭제', description: 'S3 객체를 지우고(best-effort) row 를 soft delete 한다.' })
  @ApiParam({ name: 'photoId', description: '사진 id', type: Number })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('photoId', ParseIntPipe) photoId: number
  ) {
    return this.photos.remove(auth.churchId, eventId, photoId);
  }
}
