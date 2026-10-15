import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { MemberPositionEntity } from '@src/database/entities/member-position.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { PositionEntity } from '@src/database/entities/position.entity';
import { todayString } from '@src/common/date';
import { PromotePositionDto } from './dto/promote.dto';

export type PositionHistoryItem = {
  id: number;
  positionId: number;
  positionName: string | null;
  startDate: string;
  endDate: string | null;
  note: string | null;
  isCurrent: boolean;
};

@Injectable()
export class MemberPositionService {
  /** 승직: 트랜잭션으로 현재 직분 종료 + 새 직분 row 생성. */
  async promote(churchId: number, memberId: number, dto: PromotePositionDto): Promise<MemberPositionEntity> {
    const today = dto.startDate ?? todayString();

    await this.assertMember(churchId, memberId);
    await this.assertPosition(churchId, dto.positionId);

    return DataSources.instance.transaction(async manager => {
      const repo = manager.getRepository(MemberPositionEntity);
      const current = await repo.findOne({
        where: { churchId, memberId, endDate: IsNull() },
      });

      if (current?.positionId === dto.positionId) {
        throw new ConflictException('이미 동일 직분에 있습니다.');
      }

      if (current) {
        await repo.update(current.id, { endDate: today });
      }

      const next = repo.create({
        churchId,
        memberId,
        positionId: dto.positionId,
        startDate: today,
        note: dto.note,
      });
      return repo.save(next);
    });
  }

  async endCurrent(churchId: number, memberId: number): Promise<void> {
    const today = todayString();
    const repo = DataSources.instance.getRepository(MemberPositionEntity);
    const current = await repo.findOne({
      where: { churchId, memberId, endDate: IsNull() },
    });
    if (!current) {
      throw new NotFoundException('활성 직분이 없습니다.');
    }
    await repo.update(current.id, { endDate: today });
  }

  /**
   * 여러 성도의 **현재** 사역 역할을 한 번에 — 교인 목록 화면용(N+1 방지).
   * 종료되지 않은(endDate IS NULL) 한 건씩만 담는다.
   */
  async currentForMembers(churchId: number, memberIds: number[]): Promise<Map<number, { id: number; name: string | null }>> {
    const result = new Map<number, { id: number; name: string | null }>();
    if (memberIds.length === 0) return result;

    const rows = await DataSources.instance
      .getRepository(MemberPositionEntity)
      .find({ where: { churchId, memberId: In(memberIds), endDate: IsNull() }, order: { startDate: 'DESC', id: 'DESC' } });
    if (rows.length === 0) return result;

    const positionIds = Array.from(new Set(rows.map(row => row.positionId)));
    const positions = await DataSources.instance.getRepository(PositionEntity).find({ where: { id: In(positionIds), churchId } });
    const nameById = new Map(positions.map(position => [position.id, position.name]));

    for (const row of rows) {
      // 같은 사람에게 열린 역할이 둘일 수는 없지만, 있어도 최신 것만 남긴다.
      if (!result.has(row.memberId)) {
        result.set(row.memberId, { id: row.positionId, name: nameById.get(row.positionId) ?? null });
      }
    }
    return result;
  }

  /** 현재 직분 + 이력 모두 (시작일 내림차순). */
  async history(
    churchId: number,
    memberId: number
  ): Promise<{
    current: PositionHistoryItem | null;
    history: PositionHistoryItem[];
  }> {
    const repo = DataSources.instance.getRepository(MemberPositionEntity);
    const rows = await repo.find({
      where: { churchId, memberId },
      order: { startDate: 'DESC', id: 'DESC' },
    });
    if (rows.length === 0) return { current: null, history: [] };

    const positionIds = Array.from(new Set(rows.map(positionRecord => positionRecord.positionId)));
    const positions = await DataSources.instance.getRepository(PositionEntity).find({ where: positionIds.map(id => ({ id, churchId })) });
    const positionMap = new Map(positions.map(position => [position.id, position.name]));

    const items: PositionHistoryItem[] = rows.map(positionRecord => ({
      id: positionRecord.id,
      positionId: positionRecord.positionId,
      positionName: positionMap.get(positionRecord.positionId) ?? null,
      startDate: positionRecord.startDate,
      endDate: positionRecord.endDate ?? null,
      note: positionRecord.note ?? null,
      isCurrent: positionRecord.endDate === null || positionRecord.endDate === undefined,
    }));

    const current = items.find(item => item.isCurrent) ?? null;
    return { current, history: items };
  }

  private async assertMember(churchId: number, memberId: number): Promise<void> {
    const member = await DataSources.instance.getRepository(MemberEntity).findOne({ where: { id: memberId, churchId } });
    if (!member) throw new NotFoundException('Member not found');
  }

  private async assertPosition(churchId: number, positionId: number): Promise<void> {
    const p = await DataSources.instance.getRepository(PositionEntity).findOne({ where: { id: positionId, churchId } });
    if (!p) throw new BadRequestException('Position not found in this church');
  }
}
