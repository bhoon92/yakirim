import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 교인 명부의 저장된 보기 — 노션 데이터베이스의 보기 탭처럼 필터 묶음에 이름을 붙여 교회 전체가 함께 쓴다.
 * 같은 교회 안에서 이름은 겹치지 않는다(지운 것 제외). SQL 은 엔티티에서 계산한 그대로(인덱스 이름 포함).
 */
export class MemberView1788260000000 implements MigrationInterface {
  name = 'MemberView1788260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "member_view" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying(40) NOT NULL, "filters" jsonb NOT NULL, "sort_order" smallint NOT NULL DEFAULT '0', "created_by_account_id" integer, CONSTRAINT "PK_8eb653cc20f449ccdfb0f283c99" PRIMARY KEY ("id")); COMMENT ON COLUMN "member_view"."name" IS '보기 이름 (예: 담당 없는 새가족)'; COMMENT ON COLUMN "member_view"."filters" IS '교인 목록 필터 — MemberViewFilters'; COMMENT ON COLUMN "member_view"."created_by_account_id" IS '만든 계정'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e43791300c131a22f89476b25c" ON "member_view" ("church_id", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_c9df03ba78d9593e2c7d30fb3f" ON "member_view" ("church_id") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_c9df03ba78d9593e2c7d30fb3f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e43791300c131a22f89476b25c"`);
    await queryRunner.query(`DROP TABLE "member_view"`);
  }
}
