import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { CohortStatus } from '@src/database/entities/training-cohort.entity';
import { EnrollmentStatus } from '@src/database/entities/training-enrollment.entity';

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

export class CreateCohortDto {
  @IsInt()
  @Min(1)
  courseId!: number;

  /**
   * 기수 이름. 담당자가 직접 적는다 — "5기" 여도 되고 "2026 봄학기" 여도 된다.
   * 같은 과정 안에서 중복될 수 없다(409).
   */
  @IsString()
  @Length(1, 40)
  name!: string;

  @Matches(YYYY_MM_DD, { message: 'startDate must be YYYY-MM-DD' })
  startDate!: string;

  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;

  /** 생성할 회차 수. 생략하면 과정의 defaultSessionCount 를 따른다. */
  @IsOptional()
  @IsInt()
  @Min(1)
  sessionCount?: number;

  /** 담당 사역자 (member id). */
  @IsOptional()
  @IsInt()
  @Min(1)
  leaderMemberId?: number;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;
}

export class UpdateCohortDto extends PartialType(CreateCohortDto) {
  @IsOptional()
  @IsEnum(CohortStatus)
  status?: CohortStatus;
}

export class ListCohortQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId?: number;

  @IsOptional()
  @IsEnum(CohortStatus)
  status?: CohortStatus;
}

export class UpdateSessionDto {
  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  topic?: string;
}

export class EnrollMembersDto {
  /** 한 번에 여러 명 등록. 이미 등록된 교인은 조용히 건너뛴다. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(1, { each: true })
  memberIds!: number[];
}

export class UpdateEnrollmentDto {
  /** enrolled → completed(수료) / dropped(중도포기). */
  @IsEnum(EnrollmentStatus)
  status!: EnrollmentStatus;

  /** 수료/중도포기 확정일. 생략 시 오늘. */
  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'closedAt must be YYYY-MM-DD' })
  closedAt?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;
}

export class MarkTrainingAttendanceDto {
  @IsInt()
  @Min(1)
  enrollmentId!: number;

  @IsBoolean()
  present!: boolean;
}

export class ApplyPromotionDto {
  /** 올릴 교인. 대상이 아닌 사람(이미 올라갔거나 미수료)은 서버가 건너뛴다. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(1, { each: true })
  memberIds!: number[];
}
