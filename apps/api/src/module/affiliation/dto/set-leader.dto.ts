import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class SetLeaderDto {
  @IsBoolean()
  isLeader!: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  roleLabel?: string;
}
