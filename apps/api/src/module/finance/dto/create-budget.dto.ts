import { IsEnum, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { BudgetTargetKind } from '@src/database/entities/budget-allocation.entity';

export class CreateBudgetDto {
  @IsInt()
  @Min(1)
  fiscalYearId!: number;

  @IsEnum(BudgetTargetKind)
  targetKind!: BudgetTargetKind;

  @IsInt()
  @Min(1)
  targetId!: number;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}
