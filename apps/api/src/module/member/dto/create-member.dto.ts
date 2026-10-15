import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateMemberDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  phone?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birth must be YYYY-MM-DD' })
  birth?: string;

  /** 재적상태 id (미지정 시 서버가 기본 상태로 설정) */
  @IsOptional()
  @IsInt()
  @Min(1)
  statusId?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  registeredAt?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  baptizedAt?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  confirmedAt?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  previousChurch?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  faithYears?: number;

  @IsOptional()
  @IsString()
  registrationReason?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  occupation?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  address?: string;
}
