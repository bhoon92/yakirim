import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { In, Not } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { AccountEntity } from '@src/database/entities/account.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MembershipEntity, MembershipRole } from '@src/database/entities/membership.entity';

export type TeamMember = {
  membershipId: number;
  accountId: number;
  email: string;
  name: string;
  role: MembershipRole;
  pending: boolean;
  /** 이 계정이 교인 명부의 누구인지. 간사의 "내가 맡은 사람" 화면이 이걸로 그 사람을 찾는다. */
  member: { id: number; name: string } | null;
};

@Injectable()
export class TeamService {
  private membershipRepo() {
    return DataSources.instance.getRepository(MembershipEntity);
  }
  private accountRepo() {
    return DataSources.instance.getRepository(AccountEntity);
  }

  async list(churchId: number): Promise<TeamMember[]> {
    const memberships = await this.membershipRepo().find({ where: { churchId }, order: { id: 'ASC' } });
    if (memberships.length === 0) return [];
    const accounts = await this.accountRepo().find({ where: memberships.map(membership => ({ id: membership.accountId })) });
    const accountMap = new Map(accounts.map(account => [account.id, account]));
    const memberIds = memberships.map(membership => membership.memberId).filter((id): id is number => Boolean(id));
    const members =
      memberIds.length > 0 ? await DataSources.instance.getRepository(MemberEntity).find({ where: { churchId, id: In(memberIds) } }) : [];
    const memberMap = new Map(members.map(member => [member.id, member.name]));
    return memberships.map(membership => {
      const account = accountMap.get(membership.accountId);
      return {
        membershipId: membership.id,
        accountId: membership.accountId,
        email: account?.email ?? '(알 수 없음)',
        name: account?.name ?? '(알 수 없음)',
        role: membership.role,
        pending: account?.googleId?.startsWith('pending:') ?? false,
        member:
          membership.memberId && memberMap.has(membership.memberId)
            ? { id: membership.memberId, name: memberMap.get(membership.memberId)! }
            : null,
      };
    });
  }

  /**
   * 계정 ↔ 교인 연결. memberId 가 null 이면 해제.
   * 한 교인은 한 계정에만 연결된다 — 둘이면 "내가 맡은 사람"이 누구 것인지 모호해진다.
   */
  async linkMember(churchId: number, membershipId: number, memberId: number | null): Promise<void> {
    const membership = await this.membershipRepo().findOne({ where: { id: membershipId, churchId } });
    if (!membership) throw new NotFoundException('멤버를 찾을 수 없습니다.');
    if (memberId !== null) {
      const member = await DataSources.instance.getRepository(MemberEntity).findOne({ where: { id: memberId, churchId } });
      if (!member) throw new NotFoundException('교인을 찾을 수 없습니다.');
      const taken = await this.membershipRepo().findOne({ where: { churchId, memberId, id: Not(membershipId) } });
      if (taken) {
        const account = await this.accountRepo().findOne({ where: { id: taken.accountId } });
        throw new ConflictException(`${member.name} 님은 이미 다른 계정(${account?.email ?? '알 수 없음'})에 연결되어 있습니다.`);
      }
    }
    await this.membershipRepo().update(membership.id, { memberId });
  }

  /** 이메일로 초대 — 미가입이면 pending account 생성, 로그인 시 클레임. */
  async invite(churchId: number, email: string, role: MembershipRole): Promise<TeamMember> {
    if (role === MembershipRole.OWNER) {
      throw new BadRequestException('소유자 역할로는 초대할 수 없습니다.');
    }
    const normalized = email.trim().toLowerCase();

    let account = await this.accountRepo().findOne({ where: { email: normalized } });
    if (!account) {
      account = await this.accountRepo().save(
        this.accountRepo().create({
          googleId: `pending:${normalized}`,
          email: normalized,
          name: normalized.split('@')[0],
        })
      );
    }

    const existing = await this.membershipRepo().findOne({ where: { accountId: account.id, churchId } });
    if (existing) {
      throw new ConflictException('이미 이 교회의 멤버입니다.');
    }

    const membership = await this.membershipRepo().save(this.membershipRepo().create({ accountId: account.id, churchId, role }));
    return {
      membershipId: membership.id,
      accountId: account.id,
      email: account.email,
      name: account.name,
      role: membership.role,
      pending: account.googleId.startsWith('pending:'),
      member: null,
    };
  }

  async updateRole(churchId: number, membershipId: number, role: MembershipRole): Promise<void> {
    const membership = await this.membershipRepo().findOne({ where: { id: membershipId, churchId } });
    if (!membership) throw new NotFoundException('멤버를 찾을 수 없습니다.');
    if (membership.role === MembershipRole.OWNER || role === MembershipRole.OWNER) {
      throw new ForbiddenException('소유자 역할은 변경할 수 없습니다.');
    }
    await this.membershipRepo().update(membership.id, { role });
  }

  async remove(churchId: number, membershipId: number): Promise<void> {
    const membership = await this.membershipRepo().findOne({ where: { id: membershipId, churchId } });
    if (!membership) throw new NotFoundException('멤버를 찾을 수 없습니다.');
    if (membership.role === MembershipRole.OWNER) {
      throw new ForbiddenException('소유자는 제거할 수 없습니다.');
    }
    await this.membershipRepo().softDelete(membership.id);
  }
}
