import { BadRequestException, Controller, Get, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { ImportService } from './import.service';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** @types/multer 를 따로 넣지 않으려고 필요한 필드만 좁게 선언한다. */
type UploadedXlsx = { buffer: Buffer; originalname: string; size: number };

@ApiTags(SwaggerTag.IMPORT)
@ApiAuth()
@Controller('import')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  @Get('members/template')
  @Permissions('member:read')
  @ApiProduces(XLSX_MIME)
  @ApiOperation({
    summary: '교인 가져오기 서식',
    description: [
      '빈 서식을 내려준다. 열 구성은 **교인 명부 내보내기와 동일**하다.',
      '',
      "'안내' 시트에 이 교회에서 실제로 쓸 수 있는 재적상태 목록이 함께 들어간다.",
    ].join('\n'),
  })
  @ApiOkResponse({ description: 'XLSX 파일', schema: { type: 'string', format: 'binary' } })
  async template(@RequireChurch() auth: AuthContext & { churchId: number }, @Res() res: Response) {
    const buffer = await this.imports.membersTemplate(auth.churchId);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent('members-template.xlsx')}"`);
    res.send(buffer);
  }

  @Post('members')
  @Permissions('member:write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })
  @ApiQuery({
    name: 'dryRun',
    required: false,
    type: Boolean,
    description: '`true` 면 **저장하지 않고** 결과만 계산한다. 실제 반영 전에 먼저 태워 볼 것.',
  })
  @ApiOperation({
    summary: '교인 명부 가져오기',
    description: [
      'XLSX 를 읽어 교인을 생성·수정한다.',
      '',
      '- 이름+연락처가 이미 있으면 **수정**, 없으면 **생성**. 빈 칸은 기존 값을 덮지 않는다.',
      '- 연락처가 없고 같은 이름이 둘 이상이면 그 행은 오류로 남긴다(누구인지 정할 수 없으므로).',
      '- 생성은 교인 등록과 같은 경로를 타므로 **재적상태 이력도 함께 적립**된다.',
      '- 한 행이 실패해도 나머지는 진행한다. 실패 행은 `errors[]` 에 행 번호와 함께 돌려준다.',
    ].join('\n'),
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        applied: { type: 'boolean', description: 'dryRun 이면 false' },
        total: { type: 'number' },
        created: { type: 'number' },
        updated: { type: 'number' },
        unchanged: { type: 'number' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: { row: { type: 'number' }, name: { type: 'string' }, message: { type: 'string' } },
          },
        },
      },
    },
  })
  async members(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @UploadedFile() file: UploadedXlsx | undefined,
    @Query('dryRun') dryRun?: string
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('파일이 없습니다. `file` 필드로 .xlsx 를 올려 주세요.');
    return this.imports.importMembers(auth.churchId, file.buffer, dryRun === 'true');
  }
}
