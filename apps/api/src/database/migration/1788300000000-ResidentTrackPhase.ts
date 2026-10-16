import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 간사 트랙에 진입 구간을 둔다 — 성도와 간사는 2트랙이다 (2026-10-16 사용자).
 * 간사는 성도 단계의 다음 칸이 아니라 지원 → 면담 → 훈련·선교 과정을 거쳐 헌신·입주로 들어온다.
 *
 * 1. resident_status.phase — preparing(진입 준비) / resident(간사) / left(떠남). 노션 status 의 묶음과 같은 역할
 * 2. 기존 상태: 집계(counts_as_active) 상태 → resident, 나머지 → left (기본 시드 기준 활동·안식 / 퇴소)
 * 3. 간사 상태가 있는 교회마다 진입 상태 3개를 맨 앞에 넣는다(같은 이름이 이미 있으면 건너뜀). 기존 상태는 뒤로 민다
 *
 * 되돌리면 phase 칸만 지운다 — 넣은 진입 상태는 보통 상태로 남는다(지운 사람이 쓰고 있을 수 있어서).
 */
export class ResidentTrackPhase1788300000000 implements MigrationInterface {
  name = 'ResidentTrackPhase1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "resident_status" ADD "phase" character varying(16) NOT NULL DEFAULT 'resident'`);
    await queryRunner.query(`COMMENT ON COLUMN "resident_status"."phase" IS '구간 — preparing 진입 준비 / resident 간사 / left 떠남'`);
    await queryRunner.query(`UPDATE "resident_status" SET "phase" = 'left' WHERE "counts_as_active" = false`);

    await queryRunner.query(
      `UPDATE "resident_status" SET "sort_order" = "sort_order" + 3 WHERE "church_id" IN (SELECT DISTINCT "church_id" FROM "resident_status")`
    );
    const entry: [string, number, string][] = [
      ['지원', 0, '간사로 살겠다고 지원한 사람'],
      ['면담', 1, '김선교 선교사님 등과 면담 중'],
      ['훈련·선교 과정', 2, '훈련·선교 과정을 듣는 중'],
    ];
    for (const [name, sortOrder, description] of entry) {
      await queryRunner.query(
        `INSERT INTO "resident_status" ("church_id", "name", "description", "sort_order", "is_active", "counts_as_active", "phase")
         SELECT churches."church_id", $1::varchar, $3::text, $2::smallint, true, false, 'preparing'
           FROM (SELECT DISTINCT "church_id" FROM "resident_status") churches
          WHERE NOT EXISTS (
            SELECT 1 FROM "resident_status" s
             WHERE s."church_id" = churches."church_id" AND s."name" = $1::varchar AND s."deleted_at" IS NULL
          )`,
        [name, sortOrder, description]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "resident_status" DROP COLUMN "phase"`);
  }
}
