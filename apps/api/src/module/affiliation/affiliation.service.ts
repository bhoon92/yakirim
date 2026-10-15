import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { In, IsNull, ObjectLiteral, Repository } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { DepartmentEntity } from '@src/database/entities/department.entity';
import { MemberDepartmentEntity } from '@src/database/entities/member-department.entity';
import { MemberMinistryEntity } from '@src/database/entities/member-ministry.entity';
import { MemberSmallGroupEntity } from '@src/database/entities/member-small-group.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MinistryEntity } from '@src/database/entities/ministry.entity';
import { SmallGroupEntity } from '@src/database/entities/small-group.entity';
import { todayString } from '@src/common/date';
import { AssignAffiliationDto } from './dto/assign.dto';

export type AffiliationKind = 'department' | 'ministry' | 'smallGroup';

/** 목록에 붙일 소속 태그. `id` 는 reference id — 화면에서 색을 정하는 값으로도 쓴다. */
export type AffiliationTag = { id: number; name: string | null; isLeader: boolean };
export type AffiliationTagSet = {
  departments: AffiliationTag[];
  ministries: AffiliationTag[];
  smallGroups: AffiliationTag[];
};

type JoinRow = ObjectLiteral & {
  id: number;
  churchId: number;
  memberId: number;
  startDate: string;
  endDate?: string | null;
  isLeader: boolean;
  roleLabel?: string | null;
};

type EntityClass<T> = { new (): T };

type Config<J extends JoinRow, R extends ObjectLiteral> = {
  joinEntity: EntityClass<J>;
  referenceEntity: EntityClass<R>;
  referenceKey: keyof J; // e.g., 'departmentId'
};

const CONFIGS = {
  department: {
    joinEntity: MemberDepartmentEntity,
    referenceEntity: DepartmentEntity,
    referenceKey: 'departmentId' as const,
  },
  ministry: {
    joinEntity: MemberMinistryEntity,
    referenceEntity: MinistryEntity,
    referenceKey: 'ministryId' as const,
  },
  smallGroup: {
    joinEntity: MemberSmallGroupEntity,
    referenceEntity: SmallGroupEntity,
    referenceKey: 'smallGroupId' as const,
  },
} as const;

@Injectable()
export class AffiliationService {
  async assign(kind: AffiliationKind, churchId: number, memberId: number, dto: AssignAffiliationDto): Promise<JoinRow> {
    const config = CONFIGS[kind] as Config<JoinRow, ObjectLiteral>;
    await this.assertMember(churchId, memberId);
    await this.assertReference(config.referenceEntity, churchId, dto.referenceId);

    const joinRepo = DataSources.instance.getRepository(config.joinEntity) as Repository<JoinRow>;

    const existing = await joinRepo.findOne({
      where: {
        churchId,
        memberId,
        [config.referenceKey]: dto.referenceId,
        endDate: IsNull(),
      } as never,
    });
    if (existing) {
      throw new ConflictException('이미 활성 소속이 있습니다.');
    }

    const row = new config.joinEntity() as JoinRow;
    Object.assign(row, {
      churchId,
      memberId,
      [config.referenceKey]: dto.referenceId,
      startDate: dto.startDate ?? this.today(),
      isLeader: dto.isLeader ?? false,
      roleLabel: dto.roleLabel,
    });
    return joinRepo.save(row);
  }

  async end(kind: AffiliationKind, churchId: number, memberId: number, referenceId: number): Promise<void> {
    const config = CONFIGS[kind] as Config<JoinRow, ObjectLiteral>;
    const joinRepo = DataSources.instance.getRepository(config.joinEntity) as Repository<JoinRow>;

    const existing = await joinRepo.findOne({
      where: {
        churchId,
        memberId,
        [config.referenceKey]: referenceId,
        endDate: IsNull(),
      } as never,
    });
    if (!existing) {
      throw new NotFoundException('활성 소속을 찾을 수 없습니다.');
    }
    await joinRepo.update(existing.id, { endDate: this.today() } as never);
  }

  /** 활성 소속의 리더 여부/호칭 토글. */
  async setLeader(
    kind: AffiliationKind,
    churchId: number,
    memberId: number,
    referenceId: number,
    isLeader: boolean,
    roleLabel?: string
  ): Promise<JoinRow> {
    const config = CONFIGS[kind] as Config<JoinRow, ObjectLiteral>;
    const joinRepo = DataSources.instance.getRepository(config.joinEntity) as Repository<JoinRow>;

    const existing = await joinRepo.findOne({
      where: {
        churchId,
        memberId,
        [config.referenceKey]: referenceId,
        endDate: IsNull(),
      } as never,
    });
    if (!existing) {
      throw new NotFoundException('활성 소속을 찾을 수 없습니다.');
    }
    await joinRepo.update(existing.id, { isLeader, roleLabel: isLeader ? roleLabel : null } as never);
    return (await joinRepo.findOne({ where: { id: existing.id } as never }))!;
  }

  /** 특정 소속(reference)에 활성으로 속한 성도 id 목록 (성도 검색 필터용). */
  async memberIdsFor(kind: AffiliationKind, churchId: number, referenceId: number): Promise<number[]> {
    const config = CONFIGS[kind] as Config<JoinRow, ObjectLiteral>;
    const joinRepo = DataSources.instance.getRepository(config.joinEntity) as Repository<JoinRow>;
    const rows = await joinRepo.find({
      where: { churchId, [config.referenceKey]: referenceId, endDate: IsNull() } as never,
    });
    return Array.from(new Set(rows.map(joinRow => joinRow.memberId)));
  }

  /**
   * 여러 성도의 **현재** 소속을 한 번에 — 교인 목록 화면용.
   * 성도마다 listForMember 를 부르면 20행에 60번 질의가 나간다(N+1). 종류별로 한 번씩만 읽는다.
   */
  async currentForMembers(churchId: number, memberIds: number[]): Promise<Map<number, AffiliationTagSet>> {
    const result = new Map<number, AffiliationTagSet>();
    if (memberIds.length === 0) return result;
    for (const memberId of memberIds) result.set(memberId, { departments: [], ministries: [], smallGroups: [] });

    const BUCKET: Record<AffiliationKind, keyof AffiliationTagSet> = {
      department: 'departments',
      ministry: 'ministries',
      smallGroup: 'smallGroups',
    };

    await Promise.all(
      (Object.keys(CONFIGS) as AffiliationKind[]).map(async kind => {
        const config = CONFIGS[kind] as Config<JoinRow, ObjectLiteral>;
        const joinRepo = DataSources.instance.getRepository(config.joinEntity) as Repository<JoinRow>;
        const joins = await joinRepo.find({
          where: { churchId, memberId: In(memberIds), endDate: IsNull() } as never,
          order: { createdAt: 'ASC' } as never,
        });
        if (joins.length === 0) return;

        const referenceIds = Array.from(new Set(joins.map(joinRow => joinRow[config.referenceKey] as number)));
        const references = (await DataSources.instance
          .getRepository(config.referenceEntity)
          .find({ where: { id: In(referenceIds) } as never })) as { id: number; name: string }[];
        const nameById = new Map(references.map(reference => [reference.id, reference.name]));

        for (const joinRow of joins) {
          const referenceId = joinRow[config.referenceKey] as number;
          result.get(joinRow.memberId)?.[BUCKET[kind]].push({
            id: referenceId,
            name: nameById.get(referenceId) ?? null,
            isLeader: joinRow.isLeader,
          });
        }
      })
    );

    return result;
  }

  async listForMember(churchId: number, memberId: number) {
    const [departments, ministries, smallGroups] = await Promise.all([
      this.currentJoins('department', churchId, memberId),
      this.currentJoins('ministry', churchId, memberId),
      this.currentJoins('smallGroup', churchId, memberId),
    ]);
    return { departments, ministries, smallGroups };
  }

  private async currentJoins(kind: AffiliationKind, churchId: number, memberId: number) {
    const config = CONFIGS[kind] as Config<JoinRow, ObjectLiteral>;
    const joinRepo = DataSources.instance.getRepository(config.joinEntity) as Repository<JoinRow>;
    const referenceRepo = DataSources.instance.getRepository(config.referenceEntity);

    const joins = await joinRepo.find({
      where: { churchId, memberId, endDate: IsNull() } as never,
      order: { createdAt: 'ASC' } as never,
    });
    if (joins.length === 0) return [];

    const referenceIds = joins.map(joinRow => joinRow[config.referenceKey] as number);
    const references = (await referenceRepo.find({
      where: { id: In(referenceIds) } as never,
    })) as { id: number; name: string }[];
    const referenceMap = new Map(references.map(reference => [reference.id, reference]));

    return joins.map(joinRow => {
      const reference = referenceMap.get(joinRow[config.referenceKey] as number);
      return {
        id: joinRow.id,
        referenceId: joinRow[config.referenceKey],
        referenceName: reference?.name ?? null,
        startDate: joinRow.startDate,
        isLeader: joinRow.isLeader,
        roleLabel: joinRow.roleLabel ?? null,
      };
    });
  }

  private async assertMember(churchId: number, memberId: number): Promise<void> {
    const member = await DataSources.instance.getRepository(MemberEntity).findOne({ where: { id: memberId, churchId } });
    if (!member) throw new NotFoundException('Member not found');
  }

  private async assertReference<R extends ObjectLiteral>(entity: EntityClass<R>, churchId: number, referenceId: number): Promise<void> {
    const reference = await DataSources.instance.getRepository(entity).findOne({ where: { id: referenceId, churchId } as never });
    if (!reference) throw new BadRequestException('Reference not found in this church');
  }

  private today(): string {
    return todayString();
  }
}
