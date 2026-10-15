import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { MemberViewEntity, MemberViewFilters } from '@src/database/entities/member-view.entity';
import { CreateMemberViewDto } from './dto/member-view.dto';

@Injectable()
export class MemberViewService {
  private repo() {
    return DataSources.instance.getRepository(MemberViewEntity);
  }

  list(churchId: number): Promise<MemberViewEntity[]> {
    return this.repo().find({ where: { churchId }, order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  /** 이름이 겹치면 DB 부분 유니크 인덱스가 막고 예외 필터가 409 로 바꾼다. */
  async create(churchId: number, accountId: number, dto: CreateMemberViewDto): Promise<MemberViewEntity> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('보기 이름을 입력하세요.');
    const filters = this.clean(dto.filters);
    if (Object.keys(filters).length === 0) throw new BadRequestException('저장할 필터가 없습니다.');
    const last = await this.repo().findOne({ where: { churchId }, order: { sortOrder: 'DESC' } });
    return this.repo().save(
      this.repo().create({ churchId, name, filters, sortOrder: last ? last.sortOrder + 1 : 0, createdByAccountId: accountId })
    );
  }

  async remove(churchId: number, id: number): Promise<void> {
    const result = await this.repo().softDelete({ id, churchId });
    if (!result.affected) throw new NotFoundException('보기를 찾을 수 없습니다.');
  }

  /** 빈 값은 저장하지 않는다 — 나중에 필터가 늘어도 예전 보기가 그대로 읽히게. */
  private clean(filters: MemberViewFilters): MemberViewFilters {
    const out: MemberViewFilters = {};
    if (filters.q?.trim()) out.q = filters.q.trim();
    if (filters.statusId) out.statusId = filters.statusId;
    if (filters.affiliationKind && filters.affiliationId) {
      out.affiliationKind = filters.affiliationKind;
      out.affiliationId = filters.affiliationId;
    }
    if (filters.stalled) out.stalled = true;
    if (filters.shepherd === 'none' || (typeof filters.shepherd === 'number' && filters.shepherd > 0)) out.shepherd = filters.shepherd;
    return out;
  }
}
