import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { UpdateReferenceDto } from '@src/module/reference/dto/update-reference.dto';
import { UpsertReferenceDto } from '@src/module/reference/dto/upsert-reference.dto';

/**
 * 재적상태는 다른 기준정보와 달리 **양성 파이프라인 단계**라서 정체 판정 기준을 하나 더 갖는다.
 * 공용 UpsertReferenceDto 에 넣으면 사역팀·예배 같은 곳까지 이 필드가 새어 나가므로 여기서만 확장한다.
 */
const STALLS_DOC = '이 단계에 며칠 이상 머무르면 정체로 볼지. 비우면(null) 정체 판정에서 제외한다 — 파송·이명처럼 도착점인 단계.';

export class CreateMemberStatusDto extends UpsertReferenceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  stallsAfterDays?: number | null;
}

export class UpdateMemberStatusDto extends UpdateReferenceDto {
  /** {@link STALLS_DOC} */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  stallsAfterDays?: number | null;
}

export { STALLS_DOC };
