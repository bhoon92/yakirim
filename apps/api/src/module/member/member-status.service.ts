import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MemberStatusHistoryEntity } from '@src/database/entities/member-status-history.entity';
import { TrainingCourseEntity } from '@src/database/entities/training-course.entity';

export type UpsertMemberStatusInput = {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
  /** 정체 판정 기준 일수. null 이면 이 단계는 정체로 보지 않는다. */
  stallsAfterDays?: number | null;
};

/** 재적상태 reference CRUD. 익명(systemKey='anonymous')은 내부용이라 목록에서 제외. */
@Injectable()
export class MemberStatusService {
  private repo() {
    return DataSources.instance.getRepository(MemberStatusEntity);
  }

  /** 관리/선택용 목록 (익명 제외, sortOrder 순). systemKey IS DISTINCT FROM 으로 NULL도 포함. */
  list(churchId: number): Promise<MemberStatusEntity[]> {
    return this.repo()
      .createQueryBuilder('s')
      .where('s.churchId = :churchId', { churchId })
      .andWhere(`s.systemKey IS DISTINCT FROM 'anonymous'`)
      .orderBy('s.sortOrder', 'ASC')
      .addOrderBy('s.id', 'ASC')
      .getMany();
  }

  async create(churchId: number, input: UpsertMemberStatusInput): Promise<MemberStatusEntity> {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('이름을 입력하세요.');
    const row = this.repo().create({
      churchId,
      name,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      stallsAfterDays: input.stallsAfterDays ?? null,
    });
    return this.repo().save(row);
  }

  async update(churchId: number, id: number, input: UpsertMemberStatusInput): Promise<MemberStatusEntity> {
    const status = await this.repo().findOne({ where: { id, churchId } });
    if (!status) throw new NotFoundException('재적상태를 찾을 수 없습니다.');
    const patch: UpsertMemberStatusInput = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    // null 을 명시적으로 보내면 "정체 판정 안 함" 이므로 undefined 와 구분해야 한다.
    if (input.stallsAfterDays !== undefined) patch.stallsAfterDays = input.stallsAfterDays;
    await this.repo().update({ id, churchId }, patch);
    return (await this.repo().findOne({ where: { id, churchId } }))!;
  }

  async remove(churchId: number, id: number): Promise<void> {
    const status = await this.repo().findOne({ where: { id, churchId } });
    if (!status) throw new NotFoundException('재적상태를 찾을 수 없습니다.');
    if (status.systemKey) {
      throw new ConflictException('코드가 참조하는 시스템 상태라 삭제할 수 없습니다. 이름은 바꿀 수 있고, 안 쓰신다면 비활성화하세요.');
    }

    const inUse = await DataSources.instance.getRepository(MemberEntity).count({ where: { churchId, statusId: id } });
    if (inUse > 0) {
      throw new ConflictException(
        `이 상태인 교인이 ${inUse}명 있어 삭제할 수 없습니다. 그 교인들을 다른 상태로 옮기거나, 지우는 대신 비활성화하세요.`
      );
    }

    // 지금 이 상태인 사람이 없어도 과거 이력이 남아 있으면 지울 수 없다 —
    // 지우면 교인 상세의 단계 타임라인에서 그 구간 이름이 사라진다.
    const inHistory = await DataSources.instance.getRepository(MemberStatusHistoryEntity).count({ where: { churchId, statusId: id } });
    if (inHistory > 0) {
      throw new ConflictException(
        `과거에 이 상태를 거친 기록이 ${inHistory}건 있어 삭제할 수 없습니다. 지우면 단계 이동 이력이 끊깁니다 — 비활성화하세요.`
      );
    }

    // 훈련 과정이 "수료하면 이 단계로" 제안하고 있으면 지우지 않는다 — 지우면 제안이 조용히 사라진다.
    const courses = await DataSources.instance.getRepository(TrainingCourseEntity).find({ where: { churchId, completionStatusId: id } });
    if (courses.length > 0) {
      throw new ConflictException(
        `훈련 과정(${courses.map(course => course.name).join(', ')})이 수료 시 이 단계로 올리기를 제안하고 있어 삭제할 수 없습니다. 과정 설정을 먼저 바꾸세요.`
      );
    }

    await this.repo().softDelete({ id, churchId });
  }
}
