import { IsOptional, IsString, Length, ValidateIf } from 'class-validator';

/**
 * 조직 대분류의 교회별 표시 이름.
 * 빈 문자열이나 null 을 보내면 기본값(기관/사역팀/공동체)으로 되돌린다.
 */
export class UpdateOrganizationLabelsDto {
  @IsOptional()
  @ValidateIf((_object, value) => value !== null && value !== '')
  @IsString()
  @Length(1, 20)
  departmentLabel?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null && value !== '')
  @IsString()
  @Length(1, 20)
  ministryLabel?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null && value !== '')
  @IsString()
  @Length(1, 20)
  smallGroupLabel?: string | null;
}
