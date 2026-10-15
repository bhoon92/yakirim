import { IsEnum, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { TransactionFlow } from '@src/database/entities/finance-transaction.entity';

export class CreateTransactionDto {
  @IsEnum(TransactionFlow)
  flow!: TransactionFlow;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @Length(1, 100)
  title!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  accountCategoryId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  fiscalYearId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  budgetAllocationId?: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}
