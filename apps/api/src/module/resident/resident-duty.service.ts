import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { In, Not } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { ResidentDutyAssignmentEntity } from '@src/database/entities/resident-duty-assignment.entity';
import { ResidentDutyEntity } from '@src/database/entities/resident-duty.entity';
import { ResidentProfileEntity } from '@src/database/entities/resident-profile.entity';

export type ResidentDutyTag = { id: number; name: string };
export type ResidentDutyOption = ResidentDutyTag & { sortOrder: number; assignedCount: number };

/**
 * 맡은 사역 — 노션 다중 선택처럼 동작한다.
 * 이름을 적어 붙이면 옵션이 없을 때 그 자리에서 만들고, 옵션을 지우면 붙어 있던 곳에서도 함께 빠진다.
 */
@Injectable()
export class ResidentDutyService {
  private repo() {
    return DataSources.instance.getRepository(ResidentDutyEntity);
  }

  private assignmentRepo() {
    return DataSources.instance.getRepository(ResidentDutyAssignmentEntity);
  }

  async list(churchId: number): Promise<ResidentDutyOption[]> {
    const [duties, assignments] = await Promise.all([
      this.repo().find({ where: { churchId }, order: { sortOrder: 'ASC', id: 'ASC' } }),
      this.assignmentRepo().find({ where: { churchId } }),
    ]);
    const counts = new Map<number, number>();
    for (const row of assignments) counts.set(row.dutyId, (counts.get(row.dutyId) ?? 0) + 1);
    return duties.map(duty => ({ id: duty.id, name: duty.name, sortOrder: duty.sortOrder, assignedCount: counts.get(duty.id) ?? 0 }));
  }

  /** 이름으로 붙인다. 없는 이름이면 옵션을 새로 만든다. 이미 붙어 있으면 그대로 둔다. */
  async assign(churchId: number, residentId: number, rawName: string): Promise<ResidentDutyTag> {
    const name = rawName.trim();
    if (!name) throw new BadRequestException('사역 이름을 입력하세요.');
    await this.assertResident(churchId, residentId);

    return DataSources.instance.transaction(async manager => {
      const dutyRepo = manager.getRepository(ResidentDutyEntity);
      let duty = await dutyRepo.findOne({ where: { churchId, name } });
      if (!duty) {
        const last = await dutyRepo.findOne({ where: { churchId }, order: { sortOrder: 'DESC' } });
        duty = await dutyRepo.save(dutyRepo.create({ churchId, name, sortOrder: (last?.sortOrder ?? -1) + 1 }));
      }

      const assignmentRepo = manager.getRepository(ResidentDutyAssignmentEntity);
      const existing = await assignmentRepo.findOne({ where: { churchId, residentId, dutyId: duty.id } });
      if (!existing) await assignmentRepo.save(assignmentRepo.create({ churchId, residentId, dutyId: duty.id }));
      return { id: duty.id, name: duty.name };
    });
  }

  /** 뗀다 — soft delete 라 맡았던 기간(created_at ~ deleted_at)은 남는다. */
  async unassign(churchId: number, residentId: number, dutyId: number): Promise<void> {
    const row = await this.assignmentRepo().findOne({ where: { churchId, residentId, dutyId } });
    if (!row) throw new NotFoundException('맡은 사역이 아닙니다.');
    await this.assignmentRepo().softDelete({ id: row.id, churchId });
  }

  async rename(churchId: number, dutyId: number, rawName: string): Promise<ResidentDutyTag> {
    const name = rawName.trim();
    if (!name) throw new BadRequestException('사역 이름을 입력하세요.');
    await this.assertDuty(churchId, dutyId);
    const clash = await this.repo().findOne({ where: { churchId, name, id: Not(dutyId) } });
    if (clash) throw new ConflictException(`"${name}" 사역이 이미 있습니다.`);
    await this.repo().update({ id: dutyId, churchId }, { name });
    return { id: dutyId, name };
  }

  /** 옵션 삭제 — 노션처럼 붙어 있던 모든 간사에게서 함께 빠진다. 확인은 화면이 한다. */
  async remove(churchId: number, dutyId: number): Promise<void> {
    await this.assertDuty(churchId, dutyId);
    await DataSources.instance.transaction(async manager => {
      await manager.getRepository(ResidentDutyAssignmentEntity).softDelete({ churchId, dutyId });
      await manager.getRepository(ResidentDutyEntity).softDelete({ id: dutyId, churchId });
    });
  }

  /** 목록용 — 간사 여럿의 현재 사역을 한 번에. 붙인 순서대로. */
  async currentForResidents(churchId: number, residentIds: number[]): Promise<Map<number, ResidentDutyTag[]>> {
    const result = new Map<number, ResidentDutyTag[]>();
    if (residentIds.length === 0) return result;
    const rows = await this.assignmentRepo().find({
      where: { churchId, residentId: In(residentIds) },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    if (rows.length === 0) return result;

    const duties = await this.repo().find({ where: { churchId, id: In(Array.from(new Set(rows.map(row => row.dutyId)))) } });
    const nameById = new Map(duties.map(duty => [duty.id, duty.name]));
    for (const row of rows) {
      const name = nameById.get(row.dutyId);
      if (!name) continue;
      const list = result.get(row.residentId) ?? [];
      list.push({ id: row.dutyId, name });
      result.set(row.residentId, list);
    }
    return result;
  }

  private async assertResident(churchId: number, residentId: number): Promise<void> {
    const profile = await DataSources.instance.getRepository(ResidentProfileEntity).findOne({ where: { id: residentId, churchId } });
    if (!profile) throw new NotFoundException('간사 프로필을 찾을 수 없습니다.');
  }

  private async assertDuty(churchId: number, dutyId: number): Promise<void> {
    const duty = await this.repo().findOne({ where: { id: dutyId, churchId } });
    if (!duty) throw new NotFoundException('사역을 찾을 수 없습니다.');
  }
}
