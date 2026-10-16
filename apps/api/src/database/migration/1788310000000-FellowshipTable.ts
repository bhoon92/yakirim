import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 테이블 — 예배 후 성도들끼리 나누는 자리(다른 교회의 셀·목장 모임). 네 번째 조직 대분류로 더한다.
 * 공동체(small_group)는 간사 하우스로 쓰이고 있어 따로 둔다. 구성은 공동체와 같다(연도별 기준정보 + 소속 이력 + 리더).
 * church.table_label 은 다른 대분류처럼 교회별 표시 이름. SQL 은 엔티티에서 계산한 그대로(인덱스 이름 포함).
 */
export class FellowshipTable1788310000000 implements MigrationInterface {
  name = 'FellowshipTable1788310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "fellowship_table" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "year" smallint NOT NULL, "name" character varying NOT NULL, "description" text, "sort_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_28ddd8a25978147c6cf3f6750de" PRIMARY KEY ("id")); COMMENT ON COLUMN "fellowship_table"."year" IS '편성 연도'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_533d3bc96e7cffd6ff6aaf4933" ON "fellowship_table" ("church_id", "year", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_2c7b11659f1089818602ac3c0b" ON "fellowship_table" ("church_id", "year") `);
    await queryRunner.query(`CREATE INDEX "IDX_cb8ed8f619010b58159774bfeb" ON "fellowship_table" ("church_id") `);
    await queryRunner.query(
      `CREATE TABLE "member_fellowship_table" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "member_id" integer NOT NULL, "table_id" integer NOT NULL, "start_date" date NOT NULL, "end_date" date, "is_leader" boolean NOT NULL DEFAULT false, "role_label" character varying, CONSTRAINT "PK_da8da5783f45f541c4595bbb620" PRIMARY KEY ("id")); COMMENT ON COLUMN "member_fellowship_table"."table_id" IS 'fellowship_table.id'; COMMENT ON COLUMN "member_fellowship_table"."role_label" IS '리더 호칭 (테이블 리더 등 free-form)'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1d3da3b1ea4d602e8cdc2a1b37" ON "member_fellowship_table" ("member_id", "table_id") WHERE end_date IS NULL AND deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_c52725968ee6f405e74b329c4a" ON "member_fellowship_table" ("table_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_058cffcd484be98d56af7a0521" ON "member_fellowship_table" ("member_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_a1acce45885b7c26407b7a2894" ON "member_fellowship_table" ("church_id") `);
    await queryRunner.query(`ALTER TABLE "church" ADD "table_label" character varying`);
    await queryRunner.query(`COMMENT ON COLUMN "church"."table_label" IS '테이블 대분류의 교회별 표시 이름'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "church" DROP COLUMN "table_label"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a1acce45885b7c26407b7a2894"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_058cffcd484be98d56af7a0521"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c52725968ee6f405e74b329c4a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1d3da3b1ea4d602e8cdc2a1b37"`);
    await queryRunner.query(`DROP TABLE "member_fellowship_table"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cb8ed8f619010b58159774bfeb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2c7b11659f1089818602ac3c0b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_533d3bc96e7cffd6ff6aaf4933"`);
    await queryRunner.query(`DROP TABLE "fellowship_table"`);
  }
}
