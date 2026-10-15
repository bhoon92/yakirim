import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 담당 간사 — 성도 1명당 열린 구간 하나 (재적상태 이력과 같은 모양).
 * 시드·백필 없음. 교회가 화면에서 지정한다.
 */
export class MemberShepherd1788210000000 implements MigrationInterface {
  name = 'MemberShepherd1788210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "member_shepherd" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "member_id" integer NOT NULL, "resident_id" integer NOT NULL, "start_date" date NOT NULL, "end_date" date, CONSTRAINT "PK_472cb3607123334dd6e1a3c1585" PRIMARY KEY ("id")); COMMENT ON COLUMN "member_shepherd"."resident_id" IS '담당 간사 (resident_profile)'; COMMENT ON COLUMN "member_shepherd"."start_date" IS '담당 시작일'; COMMENT ON COLUMN "member_shepherd"."end_date" IS '담당이 끝난 날. null 이면 지금 담당'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6eaaa8efda15e3e0abf0119c3a" ON "member_shepherd" ("member_id") WHERE end_date IS NULL AND deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_d786749a848386b0e2d8893c7e" ON "member_shepherd" ("church_id", "resident_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_e3ec13f2c43a87cade4fa6436d" ON "member_shepherd" ("member_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_5b4e63db23162d1571e292ff49" ON "member_shepherd" ("church_id") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_5b4e63db23162d1571e292ff49"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e3ec13f2c43a87cade4fa6436d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d786749a848386b0e2d8893c7e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6eaaa8efda15e3e0abf0119c3a"`);
    await queryRunner.query(`DROP TABLE "member_shepherd"`);
  }
}
