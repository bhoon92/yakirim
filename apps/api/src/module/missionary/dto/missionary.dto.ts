import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Min, ValidateNested } from 'class-validator';

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

/** 선교사 등록 시 교인을 새로 만들 때 쓰는 최소 정보. */
export class NewMemberDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  phone?: string;
}

export class CreateMissionaryDto {
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

  /** 시작 단계 (missionary_stage id). 생략하면 미지정으로 시작한다. */
  @IsOptional()
  @IsInt()
  @Min(1)
  stageId?: number;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  country?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  region?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  fieldWork?: string;

  /** 소속 사역팀 (보통 해외선교팀). */
  @IsOptional()
  @IsInt()
  @Min(1)
  ministryId?: number;

  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'commissionedAt must be YYYY-MM-DD' })
  commissionedAt?: string;

  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'departedAt must be YYYY-MM-DD' })
  departedAt?: string;

  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'endedAt must be YYYY-MM-DD' })
  endedAt?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;
}

/** 프로필 수정 — 현재 단계(stageId)도 여기서 바로 바꿀 수 있다(기록 없이). */
export class UpdateMissionaryDto extends PartialType(CreateMissionaryDto) {}

export class ListMissionaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stageId?: number;

  /** 'active' 면 countsAsActive 단계에 있는 사람만 (대시보드 '현재 파송'과 같은 기준). */
  @IsOptional()
  @IsString()
  scope?: 'active' | 'all';
}

export class CreateNoteDto {
  @IsString()
  @Length(1, 5000)
  content!: string;

  /**
   * 이 기록 시점의 단계. 비워두면 단계 변화 없이 메모만 남는다.
   * 값을 주면 프로필의 현재 단계도 함께 갱신된다.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  stageId?: number;

  /** 기록일. 생략 시 오늘. */
  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}

export class UpsertStageDto {
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

  /** 이 단계를 '현재 파송 중'으로 집계할지. 대시보드·재적상태 연동의 기준. */
  @IsOptional()
  @IsBoolean()
  countsAsActive?: boolean;
}

export class UpdateStageDto extends PartialType(UpsertStageDto) {}
