import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { UpsertReferenceDto } from './dto/upsert-reference.dto';

type RefRow = ObjectLiteral & {
  id: number;
  churchId: number;
  year?: number;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
};

type EntityClass<T> = { new (): T };

/** 기준정보 삭제를 막는 참조처 하나. */
export type ReferenceUsage = {
  entity: EntityClass<ObjectLiteral>;
  /** 엔티티 속성명(카멜). 예: 'positionId' */
  column: string;
  /** 사용자에게 보여줄 이름. 예: '사역 역할 이력' */
  label: string;
  /** target_kind 처럼 같은 컬럼을 여러 종류가 공유할 때 구분용 */
  extraWhere?: Record<string, unknown>;
};

@Injectable()
export class ReferenceService {
  private repo<T extends RefRow>(entity: EntityClass<T>): Repository<T> {
    return DataSources.instance.getRepository(entity);
  }

  // year 를 넘기면 연도별 reference(부서·사역팀·공동체·테이블), 안 넘기면 연도 무관 reference(직분·예배 등).
  list<T extends RefRow>(entity: EntityClass<T>, churchId: number, year?: number): Promise<T[]> {
    return this.repo(entity).find({
      where: (year != null ? { churchId, year } : { churchId }) as never,
      order: { sortOrder: 'ASC', id: 'ASC' } as never,
    });
  }

  async create<T extends RefRow>(entity: EntityClass<T>, churchId: number, dto: UpsertReferenceDto, year?: number): Promise<T> {
    const repo = this.repo(entity);
    // 정렬순서를 안 주면 맨 끝으로 — 0 으로 두면 같은 0 인 기존 항목들 사이(id 순)에 끼어 앞쪽에 나타났다
    const last =
      dto.sortOrder == null
        ? await repo.findOne({ where: { churchId, ...(year != null ? { year } : {}) } as never, order: { sortOrder: 'DESC' } as never })
        : null;
    const row = new entity();
    Object.assign(row, {
      churchId,
      name: dto.name,
      description: dto.description,
      sortOrder: dto.sortOrder ?? (last ? last.sortOrder + 1 : 0),
      isActive: dto.isActive ?? true,
      ...(year != null ? { year } : {}),
    });
    return repo.save(row);
  }

  async update<T extends RefRow>(entity: EntityClass<T>, churchId: number, id: number, dto: Partial<UpsertReferenceDto>): Promise<T> {
    const repo = this.repo(entity);
    const existing = await repo.findOne({ where: { id, churchId } as never });
    if (!existing) throw new NotFoundException('Reference not found');
    await repo.update({ id, churchId } as never, dto as never);
    return (await repo.findOne({ where: { id, churchId } as never }))!;
  }

  /**
   * 이 기준정보를 참조하는 곳. 삭제 전에 세어 보고 남아 있으면 막는다.
   * `column` 은 엔티티 속성명(카멜)이다.
   */
  async remove<T extends RefRow>(entity: EntityClass<T>, churchId: number, id: number, usages: ReferenceUsage[] = []): Promise<void> {
    // 참조가 남은 채로 지우면 이력에서 이름이 사라진다("(이름 없음)"). 조용히 깨지는 대신 막고 비활성화를 안내한다.
    for (const usage of usages) {
      const count = await DataSources.instance
        .getRepository(usage.entity)
        .count({ where: { churchId, [usage.column]: id, ...(usage.extraWhere ?? {}) } });
      if (count > 0) {
        throw new ConflictException(
          `${usage.label} ${count}건이 이 항목을 쓰고 있어 삭제할 수 없습니다. 지우는 대신 비활성화하면 새로 고를 수만 없게 되고 기존 기록은 그대로 남습니다.`
        );
      }
    }
    const result = await this.repo(entity).softDelete({ id, churchId } as never);
    if (!result.affected) throw new NotFoundException('Reference not found');
  }

  // 이전 연도(fromYear) 구성을 새 연도(toYear)로 복제. 대상 연도가 비어있을 때만 허용.
  async copyYear<T extends RefRow>(entity: EntityClass<T>, churchId: number, fromYear: number, toYear: number): Promise<T[]> {
    const repo = this.repo(entity);
    const alreadyHas = await repo.count({ where: { churchId, year: toYear } as never });
    if (alreadyHas > 0) throw new ConflictException('대상 연도에 이미 등록된 항목이 있습니다');
    const source = await repo.find({
      where: { churchId, year: fromYear } as never,
      order: { sortOrder: 'ASC', id: 'ASC' } as never,
    });
    const clones = source.map(item =>
      Object.assign(new entity(), {
        churchId,
        year: toYear,
        name: item.name,
        description: item.description,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
      })
    );
    return repo.save(clones);
  }
}
