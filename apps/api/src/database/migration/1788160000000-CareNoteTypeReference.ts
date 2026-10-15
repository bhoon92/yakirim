import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 양육기록 종류를 enum → 기준정보 테이블로.
 *
 * 손으로 썼다(생성기 미사용) — `migrationsRun: true` 라 파일이 생기는 순간 watch 서버가
 * 초안을 실행해 버리고, 무엇보다 **enum 값 → 새 테이블 id 매핑 백필은 생성기가 만들지 않는다**.
 * 백필 없이 컬럼만 바꾸면 기존 기록의 종류가 통째로 날아간다.
 *
 * 순서: 테이블 생성 → 교회별 기본 6종 시드 → type_id 널 허용 추가 → enum 값으로 매핑 백필
 *       → NOT NULL 승격 → 옛 enum 컬럼·타입 제거.
 */
export class CareNoteTypeReference1788160000000 implements MigrationInterface {
  name = 'CareNoteTypeReference1788160000000';

  /** 시드 기본값 — church-seed.ts 의 CARE_NOTE_TYPES 와 같아야 한다. */
  private static readonly DEFAULTS: { name: string; systemKey: string | null; enumValue: string | null }[] = [
    { name: '심방', systemKey: null, enumValue: 'visit' },
    { name: '면담', systemKey: null, enumValue: 'meeting' },
    { name: '양육', systemKey: null, enumValue: 'nurture' },
    { name: '상담', systemKey: null, enumValue: 'counsel' },
    { name: '파송보고', systemKey: 'field_report', enumValue: 'field_report' },
    { name: '기타', systemKey: null, enumValue: 'etc' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "care_note_type" (
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "id" SERIAL NOT NULL,
        "church_id" integer NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "sort_order" smallint NOT NULL DEFAULT '0',
        "is_active" boolean NOT NULL DEFAULT true,
        "system_key" character varying,
        CONSTRAINT "PK_9a2c2ba0f6ca9ca1b0f0b1a4c31" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_5a1b6b0f9f4f7c9d3e2a8b7c6d" ON "care_note_type" ("church_id")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7c3d9e1a4b5f6a2c8d0e3f1b9a" ON "care_note_type" ("church_id", "name") WHERE deleted_at IS NULL`
    );

    // 이미 있는 모든 교회에 기본 6종을 깔아준다. 안 하면 기존 기록을 옮길 대상이 없다.
    for (const [index, row] of CareNoteTypeReference1788160000000.DEFAULTS.entries()) {
      await queryRunner.query(
        `INSERT INTO "care_note_type" ("church_id", "name", "sort_order", "system_key")
         SELECT c."id", $1, $2, $3 FROM "church" c WHERE c."deleted_at" IS NULL`,
        [row.name, index, row.systemKey]
      );
    }

    await queryRunner.query(`ALTER TABLE "care_note" ADD "type_id" integer`);
    await queryRunner.query(`COMMENT ON COLUMN "care_note"."type_id" IS '기록 종류 (care_note_type)'`);

    // enum 문자열 → 같은 교회의 새 종류 id 로 옮긴다.
    for (const row of CareNoteTypeReference1788160000000.DEFAULTS) {
      if (!row.enumValue) continue;
      await queryRunner.query(
        `UPDATE "care_note" n
         SET "type_id" = t."id"
         FROM "care_note_type" t
         WHERE t."church_id" = n."church_id" AND t."name" = $1 AND n."type"::text = $2`,
        [row.name, row.enumValue]
      );
    }
    // 혹시 매핑되지 않은 행이 있으면 그 교회의 첫 종류로 떨어뜨린다(NOT NULL 승격을 막지 않도록).
    await queryRunner.query(`
      UPDATE "care_note" n
      SET "type_id" = (
        SELECT t."id" FROM "care_note_type" t
        WHERE t."church_id" = n."church_id" AND t."deleted_at" IS NULL
        ORDER BY t."sort_order", t."id" LIMIT 1
      )
      WHERE n."type_id" IS NULL
    `);

    await queryRunner.query(`ALTER TABLE "care_note" ALTER COLUMN "type_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "care_note" DROP COLUMN "type"`);
    await queryRunner.query(`DROP TYPE "public"."care_note_type_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."care_note_type_enum" AS ENUM('visit', 'meeting', 'nurture', 'counsel', 'field_report', 'etc')`
    );
    await queryRunner.query(`ALTER TABLE "care_note" ADD "type" "public"."care_note_type_enum" NOT NULL DEFAULT 'meeting'`);

    // 기본 6종은 이름으로 되돌린다. 교회가 새로 만든 종류는 대응하는 enum 값이 없어 'etc' 가 된다.
    for (const row of CareNoteTypeReference1788160000000.DEFAULTS) {
      if (!row.enumValue) continue;
      await queryRunner.query(
        `UPDATE "care_note" n
         SET "type" = $2::"public"."care_note_type_enum"
         FROM "care_note_type" t
         WHERE t."id" = n."type_id" AND t."name" = $1`,
        [row.name, row.enumValue]
      );
    }

    await queryRunner.query(`ALTER TABLE "care_note" DROP COLUMN "type_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7c3d9e1a4b5f6a2c8d0e3f1b9a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5a1b6b0f9f4f7c9d3e2a8b7c6d"`);
    await queryRunner.query(`DROP TABLE "care_note_type"`);
  }
}
