import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { TrainingFormat } from '@src/database/entities/training-course.entity';

export class CreateCourseDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  /** 진행 형태. weekly=매주, retreat=수련회, intensive=합숙. 미지정 시 weekly. */
  @IsOptional()
  @IsEnum(TrainingFormat)
  format?: TrainingFormat;

  /** 기본 회차 수 — 기수를 열 때 이만큼 회차가 자동 생성된다. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  defaultSessionCount?: number;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** 훈련 사다리 단계 번호. null 을 보내면 사다리 밖 과정이 된다. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  step?: number | null;

  /** 수료 시 올리기를 제안할 재적상태 id. null 을 보내면 제안하지 않는다. */
  @IsOptional()
  @IsInt()
  @Min(1)
  completionStatusId?: number | null;

  /** 수료 시 공동체 간사 등록을 제안할지. */
  @IsOptional()
  @IsBoolean()
  completionSuggestsResident?: boolean;

  /** 직접 고른 아이콘(이모지 한 개). null 을 보내면 이름으로 자동 배정으로 되돌린다. */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string | null;
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
