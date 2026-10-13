import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 간사가 맡은 사역 — 노션 다중 선택처럼 화면에서 이름을 적으면 바로 생기는 태그.
 * - resident_duty: 교회별 옵션 목록
 * - resident_duty_assignment: 간사 × 사역. 떼면 soft delete 라 맡았던 기간이 남는다
 * 시드는 없다 — 교회가 쓰면서 채운다.
 */
export class ResidentDuty1788180000000 implements MigrationInterface {
  name = 'ResidentDuty1788180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "resident_duty" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying NOT NULL, "sort_order" smallint NOT NULL DEFAULT '0', CONSTRAINT "PK_8b5ef854b6fb75ce9bb9a7bfb7c" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_d050a0a9541de3c0824a04abde" ON "resident_duty" ("church_id", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_d46ee19d7731cbd61c37537c01" ON "resident_duty" ("church_id") `);

    await queryRunner.query(
      `CREATE TABLE "resident_duty_assignment" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "resident_id" integer NOT NULL, "duty_id" integer NOT NULL, CONSTRAINT "PK_dd07e673dc4f15a61ed528110a9" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7efc32f219d1adbe2929b9d070" ON "resident_duty_assignment" ("resident_id", "duty_id") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_fea46a67731005eaeec2c700f6" ON "resident_duty_assignment" ("duty_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_cf166e8633939be83f9dd972b1" ON "resident_duty_assignment" ("church_id") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_cf166e8633939be83f9dd972b1"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fea46a67731005eaeec2c700f6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7efc32f219d1adbe2929b9d070"`);
    await queryRunner.query(`DROP TABLE "resident_duty_assignment"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d46ee19d7731cbd61c37537c01"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d050a0a9541de3c0824a04abde"`);
    await queryRunner.query(`DROP TABLE "resident_duty"`);
  }
}
