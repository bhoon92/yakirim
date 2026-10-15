import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, Matches, Min, ValidateIf } from 'class-validator';

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

export class SetShepherdDto {
  /** 담당 간사 (resident_profile id). null 이면 담당 해제. */
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  residentId!: number | null;

  /** 바뀐 날. 생략 시 오늘. */
  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}

export class AssignFlockDto {
  /** 이 간사에게 맡길 성도. 다른 간사 담당이던 사람은 옮겨온다. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(1, { each: true })
  memberIds!: number[];
}
