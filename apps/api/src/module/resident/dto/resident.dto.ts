import { ResidentPhase } from '@src/database/entities/resident-status.entity';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Min, ValidateNested } from 'class-validator';
import { NewMemberDto } from '@src/module/missionary/dto/missionary.dto';

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

export class CreateResidentDto {
  /** 기존 교인으로 등록. `newMember` 와 둘 중 하나만 보낸다. */
  @IsOptional()
  @IsInt()
  @Min(1)
  memberId?: number;

  /** 명부에 없는 사람을 바로 등록. 교인이 함께 생성된다. */
  @IsOptional()
  @ValidateNested()
  @Type(() => NewMemberDto)
  newMember?: NewMemberDto;

  /** 시작 상태 (resident_status id). 생략하면 미지정으로 시작한다. */
  @IsOptional()
  @IsInt()
  @Min(1)
  statusId?: number;

  /** 공동체 입주일. */
  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'joinedAt must be YYYY-MM-DD' })
  joinedAt?: string;

  /** 헌신(간사 사역) 시작일. */
  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'committedAt must be YYYY-MM-DD' })
  committedAt?: string;

  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'leftAt must be YYYY-MM-DD' })
  leftAt?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;
}

export class UpdateResidentDto extends PartialType(CreateResidentDto) {
  /** 상태를 바꿀 때 이력에 함께 남길 사유. `statusId` 가 바뀔 때만 쓰인다. */
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  statusReason?: string;

  /** 상태 변경일. 생략 시 오늘. `statusId` 가 바뀔 때만 쓰인다. */
  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'statusDate must be YYYY-MM-DD' })
  statusDate?: string;
}

export class ListResidentQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  statusId?: number;

  /** 'active' 면 countsAsActive 상태에 있는 사람만 (지금 공동체에 있는 간사). */
  @IsOptional()
  @IsString()
  scope?: 'active' | 'all';
}

export class UpsertResidentStatusDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** 이 상태를 '지금 공동체에 있는 간사'로 집계할지. phase 를 함께 보내면 phase 가 이긴다(예전 클라이언트 호환). */
  @IsOptional()
  @IsBoolean()
  countsAsActive?: boolean;

  /** 구간 — preparing 진입 준비 / resident 간사 / left 떠남. */
  @IsOptional()
  @IsIn(Object.values(ResidentPhase))
  phase?: ResidentPhase;
}

export class UpdateResidentStatusDto extends PartialType(UpsertResidentStatusDto) {}

/** 맡은 사역 이름. 붙일 때 없는 이름이면 새로 만들어진다. */
export class ResidentDutyNameDto {
  @IsString()
  @Length(1, 40)
  name!: string;
}
