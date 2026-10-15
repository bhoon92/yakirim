import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiConflictResponse, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@src/common/swagger/api-auth.decorator';
import { SwaggerTag } from '@src/common/swagger/swagger-tags';
import { RequireChurch } from '@src/module/auth/decorators/current-auth.decorator';
import { Permissions } from '@src/module/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '@src/module/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@src/module/auth/guards/permissions.guard';
import type { AuthContext } from '@src/module/auth/types/auth-context';
import { TrainingCourseService } from './course.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

type Auth = AuthContext & { churchId: number };

@ApiTags(SwaggerTag.TRAINING)
@ApiAuth()
@Controller('training/courses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TrainingCourseController {
  constructor(private readonly courses: TrainingCourseService) {}

  @Get()
  @Permissions('training:read')
  @ApiOperation({
    summary: '훈련 과정 목록',
    description: [
      '반복해서 여는 훈련의 **틀** 목록 (믿음학교, 수련회 …). 실제 참가자는 기수(cohort)에 붙는다.',
      '',
      '`format` 은 weekly(매주) / retreat(수련회) / intensive(합숙) / etc, `defaultSessionCount` 는 기수 개설 시 자동 생성될 회차 수.',
    ].join('\n'),
  })
  list(@RequireChurch() auth: Auth) {
    return this.courses.list(auth.churchId);
  }

  @Post()
  @Permissions('training:write')
  @ApiOperation({ summary: '훈련 과정 추가', description: '교회 생성 시 기본 과정이 시드되므로, 새 유형을 만들 때만 사용한다.' })
  create(@RequireChurch() auth: Auth, @Body() dto: CreateCourseDto) {
    return this.courses.create(auth.churchId, dto);
  }

  @Patch(':id')
  @Permissions('training:write')
  @ApiOperation({
    summary: '훈련 과정 수정',
    description: '`defaultSessionCount` 변경은 **앞으로 개설할 기수**에만 적용된다. 이미 만들어진 회차는 그대로다.',
  })
  update(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseDto) {
    return this.courses.update(auth.churchId, id, dto);
  }

  @Delete(':id')
  @Permissions('training:write')
  @HttpCode(204)
  @ApiOperation({
    summary: '훈련 과정 삭제',
    description: '**기수가 하나라도 있으면 409**. 양성 이력이 끊기지 않도록 비활성화(`isActive: false`)를 유도한다.',
  })
  @ApiNoContentResponse({ description: '삭제 완료' })
  @ApiConflictResponse({ description: '기수가 남아 있음 — 비활성화를 사용할 것' })
  remove(@RequireChurch() auth: Auth, @Param('id', ParseIntPipe) id: number) {
    return this.courses.remove(auth.churchId, id);
  }
}
