import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { AttendanceEntity } from '@src/database/entities/attendance.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { WorshipServiceEntity } from '@src/database/entities/worship-service.entity';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

export type RosterItem = {
  memberId: number;
  name: string;
  statusName: string | null;
  present: boolean;
};

export type Roster = {
  worshipServiceId: number;
  date: string;
  items: RosterItem[];
  present: number;
  total: number;
  rate: number;
};

@Injectable()
export class AttendanceService {
  private repo() {
    return DataSources.instance.getRepository(AttendanceEntity);
  }

  /** 한 예배·날짜의 출석 명단 + 출석률. */
  async roster(churchId: number, worshipServiceId: number, date: string): Promise<Roster> {
    await this.assertWorshipService(churchId, worshipServiceId);

    const members = await DataSources.instance.getRepository(MemberEntity).find({
      where: { churchId },
      order: { name: 'ASC', id: 'ASC' },
    });
    const statuses = await DataSources.instance.getRepository(MemberStatusEntity).find({ where: { churchId } });
    const statusMap = new Map(statuses.map(status => [status.id, status]));
    // 출석 명단에서 제외 = countsInRoster=false 인 상태(별세/이명/익명).
    const roster = members.filter(member => statusMap.get(member.statusId)?.countsInRoster !== false);

    const rows = await this.repo().find({ where: { churchId, worshipServiceId, date } });
    const presentSet = new Set(rows.map(attendance => attendance.memberId));

    const items: RosterItem[] = roster.map(member => ({
      memberId: member.id,
      name: member.name,
      statusName: statusMap.get(member.statusId)?.name ?? null,
      present: presentSet.has(member.id),
    }));

    const present = items.filter(item => item.present).length;
    const total = items.length;
    return {
      worshipServiceId,
      date,
      items,
      present,
      total,
      rate: total === 0 ? 0 : Math.round((present / total) * 100),
    };
  }

  /** 출석 토글 — present=true 면 row 생성(없을 때만), false 면 활성 row soft delete. */
  async mark(churchId: number, dto: MarkAttendanceDto): Promise<{ present: boolean }> {
    await this.assertWorshipService(churchId, dto.worshipServiceId);
    await this.assertMember(churchId, dto.memberId);

    const repo = this.repo();
    const existing = await repo.findOne({
      where: { churchId, worshipServiceId: dto.worshipServiceId, memberId: dto.memberId, date: dto.date },
    });

    if (dto.present) {
      if (!existing) {
        await repo.save(repo.create({ churchId, worshipServiceId: dto.worshipServiceId, memberId: dto.memberId, date: dto.date }));
      }
      return { present: true };
    }

    if (existing) {
      await repo.softDelete(existing.id);
    }
    return { present: false };
  }

  /** 한 성도의 누적 출석 횟수 (member 상세용). soft-delete 는 자동 제외. */
  async countForMember(churchId: number, memberId: number): Promise<number> {
    return this.repo().count({ where: { churchId, memberId } });
  }

  private async assertWorshipService(churchId: number, worshipServiceId: number): Promise<void> {
    const s = await DataSources.instance.getRepository(WorshipServiceEntity).findOne({ where: { id: worshipServiceId, churchId } });
    if (!s) throw new BadRequestException('예배를 찾을 수 없습니다.');
  }

  private async assertMember(churchId: number, memberId: number): Promise<void> {
    const member = await DataSources.instance.getRepository(MemberEntity).findOne({ where: { id: memberId, churchId } });
    if (!member) throw new NotFoundException('Member not found');
  }
}
