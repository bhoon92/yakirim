import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { ChurchEntity, ChurchStatus } from '@src/database/entities/church.entity';
import { MembershipEntity, MembershipRole } from '@src/database/entities/membership.entity';
import { seedChurchReferences } from './church-seed';
import { CreateChurchDto } from './dto/create-church.dto';
import { UpdateOrganizationLabelsDto } from './dto/organization-labels.dto';

@Injectable()
export class ChurchService {
  /**
   * 새 교회 생성 + 생성자를 OWNER 멤버십으로 등록 + 기준정보 시드.
   * 시드까지 같은 트랜잭션에 묶는다 — 재적상태 없이 만들어진 교회는 교인 등록조차 안 되기 때문.
   */
  async create(accountId: number, dto: CreateChurchDto): Promise<{ church: ChurchEntity; membership: MembershipEntity }> {
    return DataSources.instance.transaction(async manager => {
      const church = await manager.getRepository(ChurchEntity).save(
        manager.getRepository(ChurchEntity).create({
          name: dto.name,
          representative: dto.representative,
          phone: dto.phone,
          address: dto.address,
          fiscalYearStartMonth: dto.fiscalYearStartMonth ?? 1,
          status: ChurchStatus.TRIAL,
        })
      );

      const membership = await manager.getRepository(MembershipEntity).save(
        manager.getRepository(MembershipEntity).create({
          accountId,
          churchId: church.id,
          role: MembershipRole.OWNER,
        })
      );

      await seedChurchReferences(manager, church.id, new Date().getFullYear());

      return { church, membership };
    });
  }

  async findById(id: number): Promise<ChurchEntity> {
    const church = await DataSources.instance.getRepository(ChurchEntity).findOne({ where: { id } });
    if (!church) throw new NotFoundException('Church not found');
    return church;
  }

  /**
   * 조직 대분류의 표시 이름 변경. 빈 문자열은 null 로 저장해 기본값으로 되돌린다.
   * 보내지 않은 항목은 건드리지 않는다.
   */
  async updateOrganizationLabels(churchId: number, dto: UpdateOrganizationLabelsDto): Promise<ChurchEntity> {
    const patch: Partial<ChurchEntity> = {};
    for (const key of ['departmentLabel', 'ministryLabel', 'smallGroupLabel'] as const) {
      if (dto[key] === undefined) continue;
      const value = dto[key];
      patch[key] = value === null || value.trim() === '' ? null : value.trim();
    }
    if (Object.keys(patch).length > 0) {
      await DataSources.instance.getRepository(ChurchEntity).update({ id: churchId }, patch);
    }
    return this.findById(churchId);
  }
}
