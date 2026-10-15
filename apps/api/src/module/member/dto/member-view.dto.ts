import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Min, ValidateNested } from 'class-validator';

export class MemberViewFiltersDto {
  @IsOptional()
  @IsString()
  @Length(0, 100)
  q?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  statusId?: number;

  @IsOptional()
  @IsIn(['department', 'ministry', 'smallGroup'])
  affiliationKind?: 'department' | 'ministry' | 'smallGroup';

  @IsOptional()
  @IsInt()
  @Min(1)
  affiliationId?: number;

  @IsOptional()
  @IsBoolean()
  stalled?: boolean;

  /** 담당 간사 resident id, 또는 'none' = 담당 없음 */
  @IsOptional()
  shepherd?: number | 'none';
}

export class CreateMemberViewDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => MemberViewFiltersDto)
  filters!: MemberViewFiltersDto;
}
