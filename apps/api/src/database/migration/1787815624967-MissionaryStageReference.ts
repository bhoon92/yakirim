import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 선교사 단계를 코드 enum 에서 **교회별 기준정보**로 전환하고, 단계 이력을 메모 중심 기록으로 교체.
 *
 * 배경: 파송 절차는 교회마다 다르다. 단계를 enum 으로 박아두면 교회가 자기 절차를 표현할 수 없고,
 * 버튼 클릭마다 이력이 자동으로 쌓여 지울 수도 없었다.
 * - missionary_stage 신설: 이름·순서·활성 + counts_as_active(현재 파송 집계 대상인지)
 * - missionary_profile.stage(enum) → stage_id(nullable int) — 단계 미지정도 허용
 * - missionary_stage_history → missionary_note: 메모(필수) + 단계(선택) + 삭제 가능
 *
 * 자동 생성물이 남기던 것들을 손으로 정리했다: 구 이력 테이블 DROP, 고아 enum 타입 3종 DROP.
 */
export class MissionaryStageReference1787815624967 implements MigrationInterface {
  name = 'MissionaryStageReference1787815624967';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) 구 단계 이력 테이블과 전용 enum 제거
    await queryRunner.query(`DROP TABLE "missionary_stage_history"`);
    await queryRunner.query(`DROP TYPE "public"."missionary_stage_history_from_stage_enum"`);
    await queryRunner.query(`DROP TYPE "public"."missionary_stage_history_to_stage_enum"`);

    // 2) 프로필의 stage(enum) → stage_id(int, nullable)
    await queryRunner.query(`DROP INDEX "public"."IDX_0f704d57b6547c92e697de8e13"`);
    await queryRunner.query(`ALTER TABLE "missionary_profile" DROP COLUMN "stage"`);
    await queryRunner.query(`DROP TYPE "public"."missionary_profile_stage_enum"`);
    await queryRunner.query(`ALTER TABLE "missionary_profile" ADD "stage_id" integer`);
    await queryRunner.query(`COMMENT ON COLUMN "missionary_profile"."stage_id" IS '현재 단계 (missionary_stage)'`);
    await queryRunner.query(
      `COMMENT ON COLUMN "missionary_profile"."commissioned_at" IS '파송 확정일 — 파송 집계 단계 첫 진입 시 자동 기록, 이후 직접 수정 가능'`
    );
    await queryRunner.query(`CREATE INDEX "IDX_5831f31dbc4116d3d726f2cd69" ON "missionary_profile" ("church_id", "stage_id") `);

    // 3) 단계 기준정보 테이블
    await queryRunner.query(
      `CREATE TABLE "missionary_stage" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying NOT NULL, "description" text, "sort_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "counts_as_active" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_ec1561459024732c536233141c0" PRIMARY KEY ("id")); COMMENT ON COLUMN "missionary_stage"."counts_as_active" IS '현재 파송 중으로 집계할 단계인지'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_820a882dfa7272b1b4bceef13a" ON "missionary_stage" ("church_id", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_727d0f7b85a29b76f73902525c" ON "missionary_stage" ("church_id") `);

    // 4) 메모 중심 기록 테이블
    await queryRunner.query(
      `CREATE TABLE "missionary_note" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "missionary_id" integer NOT NULL, "content" text NOT NULL, "stage_id" integer, "date" date NOT NULL, "recorder_account_id" integer NOT NULL, CONSTRAINT "PK_3c205e7c26b1dacb4b7e4603f73" PRIMARY KEY ("id")); COMMENT ON COLUMN "missionary_note"."content" IS '메모 본문'; COMMENT ON COLUMN "missionary_note"."stage_id" IS '이 시점의 단계 (선택)'; COMMENT ON COLUMN "missionary_note"."recorder_account_id" IS '작성자 account'`
    );
    await queryRunner.query(`CREATE INDEX "IDX_769a1db70fc912d2258f414e9c" ON "missionary_note" ("church_id", "date") `);
    await queryRunner.query(`CREATE INDEX "IDX_a4c85ea0b691c61867539def73" ON "missionary_note" ("missionary_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_938afbd53e9932c8925c40df32" ON "missionary_note" ("church_id") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_938afbd53e9932c8925c40df32"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a4c85ea0b691c61867539def73"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_769a1db70fc912d2258f414e9c"`);
    await queryRunner.query(`DROP TABLE "missionary_note"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_727d0f7b85a29b76f73902525c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_820a882dfa7272b1b4bceef13a"`);
    await queryRunner.query(`DROP TABLE "missionary_stage"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_5831f31dbc4116d3d726f2cd69"`);
    await queryRunner.query(`ALTER TABLE "missionary_profile" DROP COLUMN "stage_id"`);
    await queryRunner.query(
      `CREATE TYPE "public"."missionary_profile_stage_enum" AS ENUM('candidate', 'training', 'commissioned', 'field', 'furlough', 'returned', 'ended')`
    );
    await queryRunner.query(
      `ALTER TABLE "missionary_profile" ADD "stage" "public"."missionary_profile_stage_enum" NOT NULL DEFAULT 'candidate'`
    );
    await queryRunner.query(`COMMENT ON COLUMN "missionary_profile"."commissioned_at" IS '파송 확정일'`);
    await queryRunner.query(`CREATE INDEX "IDX_0f704d57b6547c92e697de8e13" ON "missionary_profile" ("church_id", "stage") `);

    await queryRunner.query(
      `CREATE TYPE "public"."missionary_stage_history_from_stage_enum" AS ENUM('candidate', 'training', 'commissioned', 'field', 'furlough', 'returned', 'ended')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."missionary_stage_history_to_stage_enum" AS ENUM('candidate', 'training', 'commissioned', 'field', 'furlough', 'returned', 'ended')`
    );
    await queryRunner.query(
      `CREATE TABLE "missionary_stage_history" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "missionary_id" integer NOT NULL, "from_stage" "public"."missionary_stage_history_from_stage_enum", "to_stage" "public"."missionary_stage_history_to_stage_enum" NOT NULL, "changed_at" date NOT NULL, "recorder_account_id" integer NOT NULL, "note" text, CONSTRAINT "PK_missionary_stage_history" PRIMARY KEY ("id"))`
    );
  }
}
