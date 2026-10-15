import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 심방 기록 양식 — 자주 쓰는 틀(종류·본문·기도제목·현재 상황)을 저장해 두고 새 기록에 채운다. 교회 전체가 함께 쓴다.
 * 같은 교회 안에서 이름은 겹치지 않는다(지운 것 제외). SQL 은 엔티티에서 계산한 그대로(인덱스 이름 포함).
 */
export class CareNoteTemplate1788280000000 implements MigrationInterface {
  name = 'CareNoteTemplate1788280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "care_note_template" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying(40) NOT NULL, "type_id" integer, "content" text NOT NULL, "prayer_request" text, "status_note" text, "sort_order" smallint NOT NULL DEFAULT '0', CONSTRAINT "PK_26066b837ad19d84b1eeb183fb0" PRIMARY KEY ("id")); COMMENT ON COLUMN "care_note_template"."name" IS '양식 이름'; COMMENT ON COLUMN "care_note_template"."type_id" IS '기본 기록 종류 (care_note_type). null 이면 고르지 않음'; COMMENT ON COLUMN "care_note_template"."content" IS '본문 틀'; COMMENT ON COLUMN "care_note_template"."prayer_request" IS '기도제목 틀'; COMMENT ON COLUMN "care_note_template"."status_note" IS '현재 상황 틀'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ed454d89140947fd0c45482db2" ON "care_note_template" ("church_id", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_c8721c1ab583f9e4efe2cc2c88" ON "care_note_template" ("church_id") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_c8721c1ab583f9e4efe2cc2c88"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ed454d89140947fd0c45482db2"`);
    await queryRunner.query(`DROP TABLE "care_note_template"`);
  }
}
