import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Not } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { TrainingCohortEntity } from '@src/database/entities/training-cohort.entity';
import { TrainingCourseEntity, TrainingFormat } from '@src/database/entities/training-course.entity';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

@Injectable()
export class TrainingCourseService {
  private repo() {
    return DataSources.instance.getRepository(TrainingCourseEntity);
  }

  /** `cohortCount` 는 화면이 "지우기 대신 숨기기"를 안내할 때 쓴다 — 기수가 있는 과정은 지울 수 없다. */
  async list(churchId: number): Promise<(TrainingCourseEntity & { cohortCount: number })[]> {
    const [courses, counts] = await Promise.all([
      this.repo().find({ where: { churchId }, order: { sortOrder: 'ASC', id: 'ASC' } }),
      DataSources.instance
        .getRepository(TrainingCohortEntity)
        .createQueryBuilder('c')
        .select('c.course_id', 'courseId')
        .addSelect('COUNT(*)::int', 'count')
        .where('c.church_id = :churchId', { churchId })
        .andWhere('c.deleted_at IS NULL')
        .groupBy('c.course_id')
        .getRawMany<{ courseId: number; count: number }>(),
    ]);
    const countMap = new Map(counts.map(row => [row.courseId, row.count]));
    return courses.map(course => Object.assign(course, { cohortCount: countMap.get(course.id) ?? 0 }));
  }

  async findById(churchId: number, id: number): Promise<TrainingCourseEntity> {
    const course = await this.repo().findOne({ where: { id, churchId } });
    if (!course) throw new NotFoundException('훈련 과정을 찾을 수 없습니다.');
    return course;
  }

  /**
   * 노션 선택지처럼 이름을 적는 순간 만들어진다 — 형식·회차는 기본값으로 시작해서 나중에 고친다.
   * 같은 이름이 이미 있으면 409 (숨긴 과정 포함). 화면은 그 경우 기존 과정을 고르게 한다.
   */
  async create(churchId: number, dto: CreateCourseDto): Promise<TrainingCourseEntity> {
    const name = dto.name.trim();
    await this.assertNameFree(churchId, name);
    if (dto.completionStatusId) await this.assertStatus(churchId, dto.completionStatusId);
    const last = await this.repo().findOne({ where: { churchId }, order: { sortOrder: 'DESC' } });
    return this.repo().save(
      this.repo().create({
        churchId,
        name,
        format: dto.format ?? TrainingFormat.WEEKLY,
        defaultSessionCount: dto.defaultSessionCount ?? 1,
        description: dto.description,
        sortOrder: dto.sortOrder ?? (last ? last.sortOrder + 1 : 0),
        isActive: dto.isActive ?? true,
        step: dto.step ?? null,
        completionStatusId: dto.completionStatusId ?? null,
        completionSuggestsResident: dto.completionSuggestsResident ?? false,
      })
    );
  }

  async update(churchId: number, id: number, dto: UpdateCourseDto): Promise<TrainingCourseEntity> {
    await this.findById(churchId, id);
    const patch = { ...dto };
    if (dto.name !== undefined) {
      const name = dto.name?.trim();
      if (!name) throw new BadRequestException('과정 이름을 입력하세요.');
      await this.assertNameFree(churchId, name, id);
      patch.name = name;
    }
    if (dto.completionStatusId) await this.assertStatus(churchId, dto.completionStatusId);
    await this.repo().update({ id, churchId }, patch);
    return this.findById(churchId, id);
  }

  /** 기수가 하나라도 붙어 있으면 삭제 대신 비활성화를 유도한다 (이력 보호). */
  async remove(churchId: number, id: number): Promise<void> {
    await this.findById(churchId, id);
    const cohortCount = await DataSources.instance.getRepository(TrainingCohortEntity).count({ where: { churchId, courseId: id } });
    if (cohortCount > 0) {
      throw new ConflictException(`이미 ${cohortCount}개 기수가 있는 과정입니다. 삭제 대신 비활성화(isActive: false)하세요.`);
    }
    await this.repo().softDelete({ id, churchId });
  }

  private async assertNameFree(churchId: number, name: string, exceptId?: number): Promise<void> {
    if (!name) throw new BadRequestException('과정 이름을 입력하세요.');
    const clash = await this.repo().findOne({ where: { churchId, name, ...(exceptId ? { id: Not(exceptId) } : {}) } });
    if (clash) {
      throw new ConflictException(
        clash.isActive ? `"${name}" 과정이 이미 있습니다.` : `"${name}" 과정이 숨김 상태로 있습니다. 숨김을 풀어서 쓰세요.`
      );
    }
  }

  private async assertStatus(churchId: number, statusId: number): Promise<void> {
    const status = await DataSources.instance.getRepository(MemberStatusEntity).findOne({ where: { id: statusId, churchId } });
    if (!status) throw new NotFoundException('재적상태를 찾을 수 없습니다.');
  }
}
