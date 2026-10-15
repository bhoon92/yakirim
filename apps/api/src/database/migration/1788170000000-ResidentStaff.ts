import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 공동체 간사(국내 상주 선교사) 관리.
 *
 * 배경: 교회 구성원의 중심은 공동생활을 하며 내부에서 섬기는 "다윗의열쇠 선교사" 약 50명인데,
 * 선교사 트랙은 해외 파송(국가·출국일)만 전제하고 있어 이들을 담을 자리가 없었다.
 * - resident_status: 상태 기준정보 (활동/안식/퇴소). counts_as_active = 현재 공동체 인원 집계 대상
 * - resident_profile: 교인 1명당 1개. 입주일·헌신 시작일·퇴소일
 * - resident_status_history: 상태 변경 이력
 *
 * 손으로 쓴 데이터 마이그레이션:
 * - 기존 교회에 상태 기본값 3종 시드 (새 교회는 church-seed 가 만든다)
 * - 양육기록 종류에 "케어"·"재훈련" 추가 (기획행정팀이 간사에게 하는 기록). 같은 이름이 있으면 건너뛴다
 */
export class ResidentStaff1788170000000 implements MigrationInterface {
  name = 'ResidentStaff1788170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) 상태 기준정보
    await queryRunner.query(
      `CREATE TABLE "resident_status" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying NOT NULL, "description" text, "sort_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "counts_as_active" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_5637ee43d77390cae248f69c1fa" PRIMARY KEY ("id")); COMMENT ON COLUMN "resident_status"."counts_as_active" IS '현재 공동체 인원으로 집계할 상태인지'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b3c02a9e95450c89eb5d02f818" ON "resident_status" ("church_id", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_61f4c01295e933f9c9554ef2c8" ON "resident_status" ("church_id") `);

    // 2) 프로필
    await queryRunner.query(
      `CREATE TABLE "resident_profile" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "member_id" integer NOT NULL, "status_id" integer, "joined_at" date, "committed_at" date, "left_at" date, "note" text, CONSTRAINT "PK_6cc8d08f3312cccd33f4579f41f" PRIMARY KEY ("id")); COMMENT ON COLUMN "resident_profile"."status_id" IS '현재 상태 (resident_status)'; COMMENT ON COLUMN "resident_profile"."joined_at" IS '공동체 입주일'; COMMENT ON COLUMN "resident_profile"."committed_at" IS '헌신(간사 사역) 시작일'; COMMENT ON COLUMN "resident_profile"."left_at" IS '퇴소일'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_edad10873759cad75b4548f14a" ON "resident_profile" ("member_id") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_6512e16ba2a1bea1d2572651ad" ON "resident_profile" ("church_id", "status_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_bada222d6c40c87d015e93e33a" ON "resident_profile" ("church_id") `);

    // 3) 상태 이력
    await queryRunner.query(
      `CREATE TABLE "resident_status_history" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "resident_id" integer NOT NULL, "status_id" integer NOT NULL, "date" date NOT NULL, "reason" text, "recorder_account_id" integer NOT NULL, CONSTRAINT "PK_61cf9a23d7c1c2a8a4e5cdeb5a8" PRIMARY KEY ("id")); COMMENT ON COLUMN "resident_status_history"."status_id" IS '바뀐 상태 (resident_status)'; COMMENT ON COLUMN "resident_status_history"."reason" IS '사유'; COMMENT ON COLUMN "resident_status_history"."recorder_account_id" IS '작성자 account'`
    );
    await queryRunner.query(`CREATE INDEX "IDX_8e51eb663b14622d9456d22e83" ON "resident_status_history" ("resident_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_70cb1f6183df20fbf6b2beafc3" ON "resident_status_history" ("church_id") `);

    // 4) 기존 교회에 상태 기본값
    await queryRunner.query(
      `INSERT INTO "resident_status" ("church_id", "name", "sort_order", "counts_as_active")
       SELECT c.id, s.name, s.sort_order, s.counts_as_active
       FROM "church" c
       CROSS JOIN (VALUES ('활동', 0, true), ('안식', 1, true), ('퇴소', 2, false)) AS s(name, sort_order, counts_as_active)`
    );

    // 5) 양육기록 종류 "케어"·"재훈련" — 이미 같은 이름이 있는 교회는 건너뛴다
    await queryRunner.query(
      `INSERT INTO "care_note_type" ("church_id", "name", "sort_order")
       SELECT c.id, t.name, COALESCE((SELECT MAX(sort_order) FROM "care_note_type" x WHERE x.church_id = c.id), -1) + t.offset_order
       FROM "church" c
       CROSS JOIN (VALUES ('케어', 1), ('재훈련', 2)) AS t(name, offset_order)
       WHERE NOT EXISTS (
         SELECT 1 FROM "care_note_type" e WHERE e.church_id = c.id AND e.name = t.name AND e.deleted_at IS NULL
       )`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 쓰인 적 없는 것만 지운다 — 이미 기록이 붙었으면 남겨야 기록이 고아가 되지 않는다.
    await queryRunner.query(
      `DELETE FROM "care_note_type" t
       WHERE t.name IN ('케어', '재훈련') AND NOT EXISTS (SELECT 1 FROM "care_note" n WHERE n.type_id = t.id)`
    );

    await queryRunner.query(`DROP INDEX "public"."IDX_70cb1f6183df20fbf6b2beafc3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8e51eb663b14622d9456d22e83"`);
    await queryRunner.query(`DROP TABLE "resident_status_history"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bada222d6c40c87d015e93e33a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6512e16ba2a1bea1d2572651ad"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_edad10873759cad75b4548f14a"`);
    await queryRunner.query(`DROP TABLE "resident_profile"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_61f4c01295e933f9c9554ef2c8"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b3c02a9e95450c89eb5d02f818"`);
    await queryRunner.query(`DROP TABLE "resident_status"`);
  }
}
