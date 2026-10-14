import { IsEmail, IsEnum, IsInt, Min, ValidateIf } from 'class-validator';
import { MembershipRole } from '@src/database/entities/membership.entity';

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(MembershipRole)
  role!: MembershipRole;
}

export class UpdateRoleDto {
  @IsEnum(MembershipRole)
  role!: MembershipRole;
}

export class LinkMemberDto {
  /** 이 계정이 명부의 누구인지 (member id). null 이면 연결 해제. */
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  memberId!: number | null;
}
