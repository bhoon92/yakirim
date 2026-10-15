import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { WorshipServiceEntity } from '@src/database/entities/worship-service.entity';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { AttendanceEntity } from '@src/database/entities/attendance.entity';
import { OfferingEntity } from '@src/database/entities/offering.entity';
import { UpsertReferenceDto } from './dto/upsert-reference.dto';
import { UpdateReferenceDto } from './dto/update-reference.dto';
import { createDescription, listDescription, removeDescription, updateDescription } from './reference-swagger';
import { ReferenceService } from './reference.service';

const WHAT = '예배';

@ApiTags(SwaggerTag.REFERENCE)
@ApiAuth()
@Controller('worship-services')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorshipServiceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get()
  @ApiOperation({
    summary: '예배 목록',
    description: `${listDescription(WHAT, false)}\n\n주일 1부·2부·수요예배 등 출석 체크의 단위. 출석 API 의 \`worshipServiceId\` 가 여기서 나온다.`,
  })
  list(@RequireChurch() auth: AuthContext & { churchId: number }) {
    return this.referenceService.list(WorshipServiceEntity, auth.churchId);
  }

  @Post()
  @Permissions('settings:write')
  @ApiOperation({ summary: '예배 추가', description: createDescription(WHAT, false) })
  create(@RequireChurch() auth: AuthContext & { churchId: number }, @Body() dto: UpsertReferenceDto) {
    return this.referenceService.create(WorshipServiceEntity, auth.churchId, dto);
  }

  @Patch(':id')
  @Permissions('settings:write')
  @ApiOperation({ summary: '예배 수정', description: updateDescription(WHAT) })
  update(
    @RequireChurch() auth: AuthContext & { churchId: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReferenceDto
  ) {
    return this.referenceService.update(WorshipServiceEntity, auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('settings:write')
  @HttpCode(204)
  @ApiOperation({ summary: '예배 삭제', description: `${removeDescription(WHAT)} 지난 출석 기록은 그대로 남는다.` })
  @ApiNoContentResponse({ description: '삭제 완료' })
  remove(@RequireChurch() auth: AuthContext & { churchId: number }, @Param('id', ParseIntPipe) id: number) {
    return this.referenceService.remove(WorshipServiceEntity, auth.churchId, id, [
      { entity: AttendanceEntity, column: 'worshipServiceId', label: '출석 기록' },
      { entity: OfferingEntity, column: 'worshipServiceId', label: '헌금 기록' },
    ]);
  }
}
