import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 재적상태 변경 이력 도입.
 *
 * 생성기 산출물에 두 가지를 손으로 덧붙였다(§ 자동 생성물은 초안이다):
 *   1. 기존 재적상태에 정체 기준 일수 시드 — 안 하면 컬럼만 생기고 아무도 안 쓴다.
 *   2. 기존 교인 백필 — 이력은 소급이 안 되므로, 지금 있는 사람들에게 "열린 구간"을
 *      하나씩 만들어 주지 않으면 정체 조회에서 통째로 빠진다.
 *      시작일은 정식 등록일, 없으면 레코드 생성일로 둔다(알 수 있는 가장 이른 시점).
 */
export class MemberStatusHistory1787908505893 implements MigrationInterface {
  name = 'MemberStatusHistory1787908505893';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "member_status_history" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "member_id" integer NOT NULL, "status_id" integer NOT NULL, "start_date" date NOT NULL, "end_date" date, "reason" character varying, CONSTRAINT "PK_eeb4e05f451287a4d4d2b80cdba" PRIMARY KEY ("id")); COMMENT ON COLUMN "member_status_history"."start_date" IS '이 상태가 시작된 날'; COMMENT ON COLUMN "member_status_history"."end_date" IS '다음 상태로 넘어간 날. null 이면 현재 상태'; COMMENT ON COLUMN "member_status_history"."reason" IS '변경 사유/메모'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8284fd5008178db8fd0b00778c" ON "member_status_history" ("member_id") WHERE end_date IS NULL AND deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_9732d5ff0939af21dc0829aa0f" ON "member_status_history" ("church_id", "status_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_c1481e4dcfc0d9c1a9d8234741" ON "member_status_history" ("member_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_3d493c294b2aeabd756010bf63" ON "member_status_history" ("church_id") `);
    await queryRunner.query(`ALTER TABLE "member_status" ADD "stalls_after_days" smallint`);
    await queryRunner.query(`COMMENT ON COLUMN "member_status"."stalls_after_days" IS '정체 판정 기준 일수. null 이면 판정하지 않음'`);

    // ── 여기부터 손으로 추가한 부분 ──────────────────────────────────────────

    // 1) 기본 파이프라인 단계에 정체 기준 시드.
    //    systemKey 가 있는 단계는 그것으로, 없는 단계(방문·정착)는 기본 이름으로 찾는다.
    //    이름을 바꾼 교회는 null 로 남아 정체 판정에서 빠질 뿐이라 안전하다.
    await queryRunner.query(`UPDATE "member_status" SET "stalls_after_days" = 30 WHERE "name" = '방문'`);
    await queryRunner.query(`UPDATE "member_status" SET "stalls_after_days" = 90 WHERE "system_key" = 'new'`);
    await queryRunner.query(`UPDATE "member_status" SET "stalls_after_days" = 180 WHERE "name" = '정착'`);
    await queryRunner.query(`UPDATE "member_status" SET "stalls_after_days" = 365 WHERE "system_key" = 'trainee'`);

    // 2) 기존 교인 백필 — 현재 상태로 열린 구간을 하나씩.
    await queryRunner.query(`
      INSERT INTO "member_status_history" ("church_id", "member_id", "status_id", "start_date", "reason")
      SELECT m."church_id",
             m."id",
             m."status_id",
             COALESCE(m."registered_at", (m."created_at" AT TIME ZONE 'Asia/Seoul')::date),
             '이력 도입 전부터의 상태 (백필)'
      FROM "member" m
      WHERE m."deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member_status" DROP COLUMN "stalls_after_days"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3d493c294b2aeabd756010bf63"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c1481e4dcfc0d9c1a9d8234741"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9732d5ff0939af21dc0829aa0f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8284fd5008178db8fd0b00778c"`);
    await queryRunner.query(`DROP TABLE "member_status_history"`);
  }
}
