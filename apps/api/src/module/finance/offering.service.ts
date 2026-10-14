import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { MemberEntity } from '@src/database/entities/member.entity';
import { OfferingCategoryEntity } from '@src/database/entities/offering-category.entity';
import { OfferingEntity } from '@src/database/entities/offering.entity';
import { todayString } from '@src/common/date';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';
import { ListOfferingQueryDto } from './dto/list-offering.dto';

export type OfferingItem = {
  id: number;
  memberId: number;
  memberName: string | null;
  offeringCategoryId: number;
  categoryName: string | null;
  amount: number;
  date: string;
  rawDonorName: string | null;
  note: string | null;
};

@Injectable()
export class OfferingService {
  private repo() {
    return DataSources.instance.getRepository(OfferingEntity);
  }

  async create(churchId: number, recorderAccountId: number, dto: CreateOfferingDto): Promise<OfferingEntity> {
    await this.assertMember(churchId, dto.memberId);
    await this.assertCategory(churchId, dto.offeringCategoryId);
    const row = this.repo().create({
      churchId,
      memberId: dto.memberId,
      offeringCategoryId: dto.offeringCategoryId,
      worshipServiceId: dto.worshipServiceId,
      amount: dto.amount,
      date: dto.date ?? this.today(),
      rawDonorName: dto.rawDonorName,
      note: dto.note,
      recorderAccountId,
    });
    return this.repo().save(row);
  }

  async update(churchId: number, id: number, dto: UpdateOfferingDto): Promise<OfferingEntity> {
    const row = await this.repo().findOne({ where: { id, churchId } });
    if (!row) throw new NotFoundException('Offering not found');
    if (dto.memberId !== undefined) await this.assertMember(churchId, dto.memberId);
    if (dto.offeringCategoryId !== undefined) await this.assertCategory(churchId, dto.offeringCategoryId);
    Object.assign(row, dto);
    return this.repo().save(row);
  }

  async remove(churchId: number, id: number): Promise<void> {
    // 연말정산 영수증의 근거 기록이라 실제로 지우지 않는다
    const result = await this.repo().softDelete({ id, churchId });
    if (!result.affected) throw new NotFoundException('Offering not found');
  }

  async list(churchId: number, query: ListOfferingQueryDto): Promise<{ items: OfferingItem[]; total: number; count: number }> {
    const qb = this.repo().createQueryBuilder('o').where('o.churchId = :churchId', { churchId });
    if (query.date) qb.andWhere('o.date = :date', { date: query.date });
    if (query.worshipServiceId) qb.andWhere('o.worshipServiceId = :wsid', { wsid: query.worshipServiceId });
    if (query.memberId) qb.andWhere('o.memberId = :mid', { mid: query.memberId });
    qb.orderBy('o.date', 'DESC').addOrderBy('o.id', 'DESC');

    const rows = await qb.getMany();
    const items = await this.enrich(churchId, rows);
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    return { items, total, count: items.length };
  }

  /** 연말정산 영수증용 — member 별 calendar-year 카테고리별 합계 + 총액. */
  async memberAnnualSummary(
    churchId: number,
    memberId: number,
    year: number
  ): Promise<{ year: number; total: number; byCategory: { categoryId: number; categoryName: string | null; amount: number }[] }> {
    await this.assertMember(churchId, memberId);
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const rows = (await this.repo()
      .createQueryBuilder('o')
      .select('o.offering_category_id', 'categoryId')
      .addSelect('SUM(o.amount)', 'amount')
      .where('o.church_id = :churchId', { churchId })
      .andWhere('o.member_id = :memberId', { memberId })
      .andWhere('o.date BETWEEN :start AND :end', { start, end })
      .groupBy('o.offering_category_id')
      .getRawMany()) as { categoryId: number; amount: string }[];

    const categories = await DataSources.instance.getRepository(OfferingCategoryEntity).find({ where: { churchId } });
    const nameMap = new Map(categories.map(category => [category.id, category.name]));

    const byCategory = rows.map(categorySum => ({
      categoryId: Number(categorySum.categoryId),
      categoryName: nameMap.get(Number(categorySum.categoryId)) ?? null,
      amount: Number(categorySum.amount),
    }));
    const total = byCategory.reduce((sum, category) => sum + category.amount, 0);
    return { year, total, byCategory };
  }

  /** 엑셀 내보내기용 — 기간 내 전체 헌금 (날짜 오름차순), 이름/카테고리 enrich. */
  async listByDateRange(churchId: number, start: string, end: string): Promise<OfferingItem[]> {
    const rows = await this.repo()
      .createQueryBuilder('o')
      .where('o.churchId = :churchId', { churchId })
      .andWhere('o.date BETWEEN :start AND :end', { start, end })
      .orderBy('o.date', 'ASC')
      .addOrderBy('o.id', 'ASC')
      .getMany();
    return this.enrich(churchId, rows);
  }

  /** 대시보드용 — 기간 합계. */
  async sumBetween(churchId: number, start: string, end: string): Promise<number> {
    const raw = (await this.repo()
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.amount), 0)', 'sum')
      .where('o.church_id = :churchId', { churchId })
      .andWhere('o.date BETWEEN :start AND :end', { start, end })
      .getRawOne()) as { sum: string };
    return Number(raw.sum);
  }

  private async enrich(churchId: number, rows: OfferingEntity[]): Promise<OfferingItem[]> {
    if (rows.length === 0) return [];
    const memberIds = Array.from(new Set(rows.map(offering => offering.memberId)));
    const categoryIds = Array.from(new Set(rows.map(offering => offering.offeringCategoryId)));
    const [members, categories] = await Promise.all([
      DataSources.instance.getRepository(MemberEntity).find({ where: memberIds.map(id => ({ id, churchId })) }),
      DataSources.instance.getRepository(OfferingCategoryEntity).find({ where: categoryIds.map(id => ({ id, churchId })) }),
    ]);
    const memberMap = new Map(members.map(member => [member.id, member.name]));
    const categoryMap = new Map(categories.map(category => [category.id, category.name]));

    return rows.map(offering => ({
      id: offering.id,
      memberId: offering.memberId,
      memberName: memberMap.get(offering.memberId) ?? null,
      offeringCategoryId: offering.offeringCategoryId,
      categoryName: categoryMap.get(offering.offeringCategoryId) ?? null,
      amount: offering.amount,
      date: offering.date,
      rawDonorName: offering.rawDonorName ?? null,
      note: offering.note ?? null,
    }));
  }

  private async assertMember(churchId: number, memberId: number): Promise<void> {
    const member = await DataSources.instance.getRepository(MemberEntity).findOne({ where: { id: memberId, churchId } });
    if (!member) throw new NotFoundException('Member not found');
  }

  private async assertCategory(churchId: number, categoryId: number): Promise<void> {
    const c = await DataSources.instance.getRepository(OfferingCategoryEntity).findOne({ where: { id: categoryId, churchId } });
    if (!c) throw new BadRequestException('헌금 종류를 찾을 수 없습니다.');
  }

  private today(): string {
    return todayString();
  }
}
