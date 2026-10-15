import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateFiscalYearDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
