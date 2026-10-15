import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigProvider } from '@src/config';
import { DataSources } from '@src/database/data-sources';
import { AccountEntity } from '@src/database/entities/account.entity';
import { ChurchEntity } from '@src/database/entities/church.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MembershipEntity, MembershipRole } from '@src/database/entities/membership.entity';
import { ResidentProfileEntity } from '@src/database/entities/resident-profile.entity';
import type { GoogleProfile } from './strategies/google.strategy';
import type { AuthContext, JwtPayload } from './types/auth-context';

export type AuthTokens = { accessToken: string; refreshToken: string };

export type SessionResult = {
  account: AccountEntity;
  memberships: MembershipEntity[];
  token: string;
  refreshToken: string;
  activeChurchId: number | null;
  activeRole: MembershipRole | null;
};

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  /** Google/dev 로그인 공통 진입점: upsert Account → memberships 조회 → JWT 발급 */
  async upsertAndIssueSession(profile: GoogleProfile): Promise<SessionResult> {
    const accountRepo = DataSources.instance.getRepository(AccountEntity);
    const membershipRepo = DataSources.instance.getRepository(MembershipEntity);

    let account = await accountRepo.findOne({ where: { googleId: profile.googleId } });

    // 초대로 미리 만들어진 pending 계정(googleId 미연결)을 이메일로 클레임
    if (!account) {
      const byEmail = await accountRepo.findOne({ where: { email: profile.email } });
      if (byEmail) {
        await accountRepo.update(byEmail.id, {
          googleId: profile.googleId,
          name: profile.name,
          pictureUrl: profile.pictureUrl,
          lastLoginAt: new Date(),
        });
        account = (await accountRepo.findOne({ where: { id: byEmail.id } }))!;
      }
    }

    if (!account) {
      account = await accountRepo.save(
        accountRepo.create({
          googleId: profile.googleId,
          email: profile.email,
          name: profile.name,
          pictureUrl: profile.pictureUrl,
          lastLoginAt: new Date(),
        })
      );
    } else {
      await accountRepo.update(account.id, {
        email: profile.email,
        name: profile.name,
        pictureUrl: profile.pictureUrl,
        lastLoginAt: new Date(),
      });
      account = (await accountRepo.findOne({ where: { id: account.id } }))!;
    }

    const memberships = await membershipRepo.find({
      where: { accountId: account.id },
    });

    // 멤버십이 정확히 1개면 자동으로 그 교회를 활성
    const auto = memberships.length === 1 ? memberships[0] : null;
    const activeChurchId = auto?.churchId ?? null;
    const activeRole = auto?.role ?? null;

    const { accessToken, refreshToken } = await this.issueTokens({
      accountId: account.id,
      churchId: activeChurchId,
      role: activeRole,
    });

    return { account, memberships, token: accessToken, refreshToken, activeChurchId, activeRole };
  }

  /** 다교회 소속자가 활성 교회를 바꾸기 / 첫 멤버십을 발급받은 직후 churchId를 JWT에 박기 */
  async selectChurch(accountId: number, churchId: number): Promise<{ token: string; refreshToken: string; role: MembershipRole }> {
    const membership = await DataSources.instance.getRepository(MembershipEntity).findOne({
      where: { accountId, churchId },
    });
    if (!membership) {
      throw new ForbiddenException('해당 교회에 소속되어 있지 않습니다.');
    }
    const { accessToken, refreshToken } = await this.issueTokens({ accountId, churchId, role: membership.role });
    return { token: accessToken, refreshToken, role: membership.role };
  }

  /** refresh 토큰 검증 → access·refresh 재발급(회전). 무상태. */
  async refreshSession(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, { secret: ConfigProvider.jwt.refresh.secret });
    } catch {
      throw new UnauthorizedException('유효하지 않은 refresh 토큰');
    }
    return this.issueTokens({ accountId: payload.accountId, churchId: payload.churchId ?? null, role: payload.role ?? null });
  }

  async me(auth: AuthContext) {
    const accountRepo = DataSources.instance.getRepository(AccountEntity);
    const membershipRepo = DataSources.instance.getRepository(MembershipEntity);
    const churchRepo = DataSources.instance.getRepository(ChurchEntity);

    const account = await accountRepo.findOne({ where: { id: auth.accountId } });
    if (!account) throw new UnauthorizedException('Account not found');

    const memberships = await membershipRepo.find({ where: { accountId: auth.accountId } });

    // 다교회 선택 UI 를 위해 멤버십에 교회 이름 enrich
    const churchIds = memberships.map(membership => membership.churchId);
    const churches = churchIds.length > 0 ? await churchRepo.find({ where: churchIds.map(id => ({ id })) }) : [];
    const churchNameMap = new Map(churches.map(church => [church.id, church.name]));
    const enrichedMemberships = memberships.map(membership => ({
      id: membership.id,
      accountId: membership.accountId,
      churchId: membership.churchId,
      role: membership.role,
      churchName: churchNameMap.get(membership.churchId) ?? null,
    }));

    let currentChurch: ChurchEntity | null = null;
    if (auth.churchId) {
      currentChurch = await churchRepo.findOne({ where: { id: auth.churchId } });
    }

    return { account, memberships: enrichedMemberships, currentChurch, role: auth.role, self: await this.self(auth) };
  }

  /**
   * 지금 교회에서 이 계정이 명부의 누구인지 — 계정 ↔ 교인 연결(팀 화면)이 돼 있을 때만.
   * `residentId` 가 있으면 간사라서 "내가 맡은 사람" 화면이 열린다.
   */
  private async self(auth: AuthContext): Promise<{ memberId: number; memberName: string; residentId: number | null } | null> {
    if (!auth.churchId) return null;
    const membership = await DataSources.instance
      .getRepository(MembershipEntity)
      .findOne({ where: { accountId: auth.accountId, churchId: auth.churchId } });
    if (!membership?.memberId) return null;
    const [member, resident] = await Promise.all([
      DataSources.instance.getRepository(MemberEntity).findOne({ where: { id: membership.memberId, churchId: auth.churchId } }),
      DataSources.instance
        .getRepository(ResidentProfileEntity)
        .findOne({ where: { memberId: membership.memberId, churchId: auth.churchId } }),
    ]);
    if (!member) return null;
    return { memberId: member.id, memberName: member.name, residentId: resident?.id ?? null };
  }

  private async issueTokens(payload: JwtPayload): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([this.signToken(payload), this.signRefresh(payload)]);
    return { accessToken, refreshToken };
  }

  /** access 토큰 — JwtModule 기본(access secret + 2h). */
  private signToken(payload: JwtPayload): Promise<string> {
    return this.jwt.signAsync({
      accountId: payload.accountId,
      churchId: payload.churchId ?? null,
      role: payload.role ?? null,
    });
  }

  /** refresh 토큰 — 별도 secret + 30d. */
  private signRefresh(payload: JwtPayload): Promise<string> {
    return this.jwt.signAsync(
      { accountId: payload.accountId, churchId: payload.churchId ?? null, role: payload.role ?? null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { secret: ConfigProvider.jwt.refresh.secret, expiresIn: ConfigProvider.jwt.refresh.expiresIn as any }
    );
  }
}
