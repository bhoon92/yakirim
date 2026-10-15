import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 기수 번호(ordinal 자동 채번) → 기수 이름(name 직접 입력).
 *
 * 교회가 "2026 봄학기"·"청년부 집중과정" 처럼 부르는 경우를 숫자로는 담을 수 없었다.
 *
 * 생성기 산출물은 `RENAME → DROP → ADD NOT NULL` 이라 그대로 두면
 *   (1) 기존 기수 번호가 통째로 사라지고
 *   (2) 행이 있는 테이블에 NOT NULL 컬럼을 붙여서 실패한다
 * 손으로 "널 허용으로 추가 → 백필 → NOT NULL 승격 → 옛 컬럼 제거" 순서로 바꿨다.
 * 인덱스 이름은 생성기가 준 것을 그대로 쓴다(이후 generate 가 조용하도록).
 */
export class TrainingCohortName1788146600506 implements MigrationInterface {
  name = 'TrainingCohortName1788146600506';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_5c63fbf6a4e845e92b010e411a"`);
    await queryRunner.query(`ALTER TABLE "training_cohort" ADD "name" character varying`);
    // 기존 "1기"·"2기" 표시가 그대로 유지되도록 번호를 문자열로 옮긴다.
    await queryRunner.query(`UPDATE "training_cohort" SET "name" = "ordinal"::text || '기'`);
    await queryRunner.query(`ALTER TABLE "training_cohort" ALTER COLUMN "name" SET NOT NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "training_cohort"."name" IS '기수 이름 (5기 / 2026 봄학기 …). 담당자가 직접 적는다'`);
    await queryRunner.query(`ALTER TABLE "training_cohort" DROP COLUMN "ordinal"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_659d087aa999b0eabaf20aad29" ON "training_cohort" ("course_id", "name") WHERE deleted_at IS NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_659d087aa999b0eabaf20aad29"`);
    await queryRunner.query(`ALTER TABLE "training_cohort" ADD "ordinal" smallint`);
    // 이름에서 숫자만 뽑아 되돌린다. "2026 봄학기" 처럼 숫자가 없거나 겹치면 복원할 수 없으므로
    // 과정별 생성 순서로 채운다 — down 은 되돌리기용이지 원본 보존이 아니다.
    await queryRunner.query(`
      UPDATE "training_cohort" c
      SET "ordinal" = COALESCE(
        NULLIF(regexp_replace(c."name", '\\D', '', 'g'), '')::int,
        seq.rn
      )
      FROM (SELECT id, row_number() OVER (PARTITION BY course_id ORDER BY id) AS rn FROM "training_cohort") seq
      WHERE seq.id = c.id
    `);
    await queryRunner.query(`ALTER TABLE "training_cohort" ALTER COLUMN "ordinal" SET NOT NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "training_cohort"."ordinal" IS '기수 번호 (5기 → 5)'`);
    await queryRunner.query(`ALTER TABLE "training_cohort" DROP COLUMN "name"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5c63fbf6a4e845e92b010e411a" ON "training_cohort" ("course_id", "ordinal") WHERE (deleted_at IS NULL)`
    );
  }
}
