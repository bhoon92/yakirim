import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 전체 스키마 초기화 — 키퍼스처치 기준 도메인 재편(planning 00장)에 맞춰
 * 기존 마이그레이션 10개를 하나로 재작성했다. 실서비스 데이터가 없는 시점의 정리이며,
 * 적용 전 기존 DB를 반드시 리셋할 것 (`pnpm db:reset`).
 *
 * 이전 스키마와 달라진 점:
 * - training_course / cohort / session / enrollment / attendance 신설 (훈련 도메인)
 * - missionary_profile / missionary_stage_history 신설 (파송 트랙)
 * - pastoral_record → care_note 로 재정의 (면담·양육·상담·파송보고)
 * - member.lifecycle_stage enum 제거 (member_status 참조로 일원화)
 */
export class Initial1782000000000 implements MigrationInterface {
  name = 'Initial1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "account" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "google_id" character varying NOT NULL, "email" character varying NOT NULL, "name" character varying NOT NULL, "picture_url" character varying, "last_login_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_54115ee388cdb6d86bb4bf5b2ea" PRIMARY KEY ("id")); COMMENT ON COLUMN "account"."google_id" IS 'Google sub'; COMMENT ON COLUMN "account"."picture_url" IS 'Google profile picture URL'`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_aeeb0a66019f876e66dadf58cb" ON "account" ("email") WHERE deleted_at IS NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8102f07aef2058f0e54bdfe5da" ON "account" ("google_id") WHERE deleted_at IS NULL`);
    await queryRunner.query(
      `CREATE TABLE "account_category" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying NOT NULL, "description" text, "sort_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_534910c01c9eaf39f2df194114f" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_d09de4b63e5aefeb1704964607" ON "account_category" ("church_id", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_0337e5a0b11c10181e18e7f95b" ON "account_category" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "attendance" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "worship_service_id" integer NOT NULL, "member_id" integer NOT NULL, "date" date NOT NULL, CONSTRAINT "PK_ee0ffe42c1f1a01e72b725c0cb2" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5bd097d27f38e5a6cb0d08153e" ON "attendance" ("worship_service_id", "member_id", "date") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_52d9db0d044b7bcc372147cf5e" ON "attendance" ("member_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_156c1d7491e52afd0e5f0ddb36" ON "attendance" ("church_id", "worship_service_id", "date")`);
    await queryRunner.query(`CREATE INDEX "IDX_e602fa4565b0cc419e652d4ab0" ON "attendance" ("church_id")`);
    await queryRunner.query(`CREATE TYPE "public"."budget_allocation_target_kind_enum" AS ENUM('department', 'ministry', 'small_group')`);
    await queryRunner.query(
      `CREATE TABLE "budget_allocation" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "fiscal_year_id" integer NOT NULL, "target_kind" "public"."budget_allocation_target_kind_enum" NOT NULL, "target_id" integer NOT NULL, "amount" bigint NOT NULL, "note" text, CONSTRAINT "PK_64e5d7615bc18728db857046e05" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ac1580335fdc88f005e5632c34" ON "budget_allocation" ("fiscal_year_id", "target_kind", "target_id") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_0b3fd2d0061e039d15f2dbfc29" ON "budget_allocation" ("church_id", "fiscal_year_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_9e77b4b017c74ec70e66a9bbc9" ON "budget_allocation" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "calendar" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying NOT NULL, "color" character varying NOT NULL, "description" text, "sort_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_2492fb846a48ea16d53864e3267" PRIMARY KEY ("id")); COMMENT ON COLUMN "calendar"."color" IS 'UI/구분용 색상 (oklch 또는 hex)'`
    );
    await queryRunner.query(`CREATE INDEX "IDX_fc3f62ac9854cc94dcab08edb3" ON "calendar" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "calendar_event" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "calendar_id" integer NOT NULL, "title" character varying NOT NULL, "location" character varying, "description" text, "all_day" boolean NOT NULL DEFAULT false, "start_at" TIMESTAMP WITH TIME ZONE NOT NULL, "end_at" TIMESTAMP WITH TIME ZONE, "recurrence" character varying, CONSTRAINT "PK_176fe24e6eb48c3fef696c7641f" PRIMARY KEY ("id")); COMMENT ON COLUMN "calendar_event"."recurrence" IS '반복 규칙 토큰 (daily/weekly/biweekly/monthly/yearly), null=반복없음'`
    );
    await queryRunner.query(`CREATE INDEX "IDX_7b63984097769b2e372b9e1dd9" ON "calendar_event" ("church_id", "start_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_b8a97d25d9efe9b656b960f8b3" ON "calendar_event" ("calendar_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_35e7f9e69115fb231657290f3c" ON "calendar_event" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "calendar_subscription" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "account_id" integer NOT NULL, "feed_token" character varying NOT NULL, "calendar_ids" integer array NOT NULL DEFAULT '{}', CONSTRAINT "PK_6f7bc98fda02baf865f24820520" PRIMARY KEY ("id")); COMMENT ON COLUMN "calendar_subscription"."feed_token" IS 'iCal 피드 접근 토큰 (URL 내 secret)'`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_954a147163e6183fee6ed8c611" ON "calendar_subscription" ("account_id", "church_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c64c94df68716b3e846c71aa10" ON "calendar_subscription" ("feed_token")`);
    await queryRunner.query(`CREATE TYPE "public"."care_note_type_enum" AS ENUM('meeting', 'nurture', 'counsel', 'field_report', 'etc')`);
    await queryRunner.query(
      `CREATE TABLE "care_note" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "member_id" integer NOT NULL, "recorder_account_id" integer NOT NULL, "type" "public"."care_note_type_enum" NOT NULL DEFAULT 'meeting', "date" date NOT NULL, "location" character varying, "content" text NOT NULL, "prayer_request" text, "status_note" text, CONSTRAINT "PK_3eb57e58c8856ff5701185b488d" PRIMARY KEY ("id")); COMMENT ON COLUMN "care_note"."member_id" IS '대상 교인'; COMMENT ON COLUMN "care_note"."recorder_account_id" IS '작성자 account'; COMMENT ON COLUMN "care_note"."location" IS '장소'; COMMENT ON COLUMN "care_note"."content" IS '본문'; COMMENT ON COLUMN "care_note"."prayer_request" IS '기도제목'; COMMENT ON COLUMN "care_note"."status_note" IS '현재 상황 노트'`
    );
    await queryRunner.query(`CREATE INDEX "IDX_469b26105afc54a026718aa3c3" ON "care_note" ("church_id", "date")`);
    await queryRunner.query(`CREATE INDEX "IDX_9c58241ac104051b74062904d3" ON "care_note" ("member_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_a48b3be1de7dbf76a4e9cc1fda" ON "care_note" ("church_id")`);
    await queryRunner.query(`CREATE TYPE "public"."church_status_enum" AS ENUM('active', 'trial', 'suspended')`);
    await queryRunner.query(
      `CREATE TABLE "church" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "name" character varying NOT NULL, "slug" character varying, "registration_number" character varying, "representative" character varying, "address" character varying, "phone" character varying, "logo_url" character varying, "fiscal_year_start_month" smallint NOT NULL DEFAULT '1', "status" "public"."church_status_enum" NOT NULL DEFAULT 'trial', CONSTRAINT "PK_b78b04d4dce07ba40672ef148ae" PRIMARY KEY ("id")); COMMENT ON COLUMN "church"."slug" IS '교회 url slug — 추후 도메인/링크 등에 사용'; COMMENT ON COLUMN "church"."registration_number" IS '사업자등록번호 / 고유번호 — 영수증 발급 주체'; COMMENT ON COLUMN "church"."representative" IS '대표자(담임목사)'; COMMENT ON COLUMN "church"."logo_url" IS '로고 storage key'; COMMENT ON COLUMN "church"."fiscal_year_start_month" IS '기본 회계연도 시작월 (1-12)'`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dfc7d24e5b093b11b4f8f556e7" ON "church" ("slug") WHERE deleted_at IS NULL`);
    await queryRunner.query(
      `CREATE TABLE "department" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "year" smallint NOT NULL, "name" character varying NOT NULL, "description" text, "sort_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_9a2213262c1593bffb581e382f5" PRIMARY KEY ("id")); COMMENT ON COLUMN "department"."year" IS '편성 연도'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4e1e00193ced02a60acef31e39" ON "department" ("church_id", "year", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_3a0233420031eae22e6b10a236" ON "department" ("church_id", "year")`);
    await queryRunner.query(`CREATE INDEX "IDX_c3fbe32352100d6e4caea64e37" ON "department" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "event" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying NOT NULL, "date" date, "description" text, "sort_order" smallint NOT NULL DEFAULT '0', CONSTRAINT "PK_30c2f3bbaf6d34a55f8ae6e4614" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE INDEX "IDX_9ee5168db086bf2c7636d709e4" ON "event" ("church_id", "date")`);
    await queryRunner.query(`CREATE INDEX "IDX_46ea4ba7bda7eea7591e10f961" ON "event" ("church_id")`);
    await queryRunner.query(`CREATE TYPE "public"."finance_transaction_flow_enum" AS ENUM('income', 'expense')`);
    await queryRunner.query(
      `CREATE TABLE "finance_transaction" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "fiscal_year_id" integer, "flow" "public"."finance_transaction_flow_enum" NOT NULL, "account_category_id" integer, "amount" bigint NOT NULL, "date" date NOT NULL, "title" character varying NOT NULL, "budget_allocation_id" integer, "note" text, "recorder_account_id" integer NOT NULL, CONSTRAINT "PK_2fb0ccf1341a200f665c0aa615d" PRIMARY KEY ("id")); COMMENT ON COLUMN "finance_transaction"."title" IS '적요/제목'; COMMENT ON COLUMN "finance_transaction"."budget_allocation_id" IS '지출 시 연결된 부서별 예산 (선택)'; COMMENT ON COLUMN "finance_transaction"."recorder_account_id" IS '입력자 account'`
    );
    await queryRunner.query(`CREATE INDEX "IDX_12271f337c4514c60a7886bdb3" ON "finance_transaction" ("budget_allocation_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_f453582fb24c022d3561f61e96" ON "finance_transaction" ("church_id", "fiscal_year_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_6b294cdf19ccbbc4769dfc45ab" ON "finance_transaction" ("church_id", "date")`);
    await queryRunner.query(`CREATE INDEX "IDX_7d7a6b8ae4cd43c6ae6639ab2b" ON "finance_transaction" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "fiscal_year" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "is_current" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_72fa5ea3e6b0ec7542c23bf0389" PRIMARY KEY ("id")); COMMENT ON COLUMN "fiscal_year"."name" IS '예: 2026 회계연도'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_447d653e2d35c7d97da04a79e2" ON "fiscal_year" ("church_id", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_fa5b68ceecb7abec857a1ddc36" ON "fiscal_year" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "google_calendar_connection" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "account_id" integer NOT NULL, "google_email" character varying NOT NULL, "refresh_token" text NOT NULL, "access_token" text, "access_token_expires_at" TIMESTAMP WITH TIME ZONE, "target_calendar_id" character varying NOT NULL, "calendar_id" integer array NOT NULL DEFAULT '{}', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_f303491364ac0d47bd034fcc57a" PRIMARY KEY ("id")); COMMENT ON COLUMN "google_calendar_connection"."google_email" IS '연결한 구글 계정 이메일'; COMMENT ON COLUMN "google_calendar_connection"."refresh_token" IS 'offline refresh token (평문, 암호화 TODO)'; COMMENT ON COLUMN "google_calendar_connection"."access_token" IS '캐시된 access token'; COMMENT ON COLUMN "google_calendar_connection"."access_token_expires_at" IS 'access token 만료 시각'; COMMENT ON COLUMN "google_calendar_connection"."target_calendar_id" IS 'push 대상 구글 캘린더 id'; COMMENT ON COLUMN "google_calendar_connection"."calendar_id" IS 'push 할 앱 calendar 레이어 (빈 배열=전체)'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5d31916576dc70c95e5af248c2" ON "google_calendar_connection" ("account_id", "church_id")`
    );
    await queryRunner.query(`CREATE INDEX "IDX_10f9234ae660f0043c4e66c4c7" ON "google_calendar_connection" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "google_calendar_event_link" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "connection_id" integer NOT NULL, "calendar_event_id" integer NOT NULL, "google_event_id" character varying NOT NULL, CONSTRAINT "PK_7fc357a0f0a96d64003d6dab257" PRIMARY KEY ("id")); COMMENT ON COLUMN "google_calendar_event_link"."google_event_id" IS '구글 캘린더 일정 id'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0c7d85efce3f4e01b2013bc4dc" ON "google_calendar_event_link" ("connection_id", "calendar_event_id")`
    );
    await queryRunner.query(`CREATE INDEX "IDX_3551749c928275bba2162c0074" ON "google_calendar_event_link" ("calendar_event_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_fecb1a7415bd06c14d4c00f455" ON "google_calendar_event_link" ("connection_id")`);
    await queryRunner.query(
      `CREATE TABLE "member" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying NOT NULL, "phone" character varying, "birth" date, "status_id" integer NOT NULL, "note" text, "registered_at" date, "baptized_at" date, "confirmed_at" date, "previous_church" character varying, "faith_years" smallint, "registration_reason" text, "occupation" character varying, "address" character varying, "raw_donor_name" character varying, CONSTRAINT "PK_97cbbe986ce9d14ca5894fdc072" PRIMARY KEY ("id")); COMMENT ON COLUMN "member"."note" IS '비고/노트'; COMMENT ON COLUMN "member"."registered_at" IS '정식 등록일'; COMMENT ON COLUMN "member"."baptized_at" IS '세례일'; COMMENT ON COLUMN "member"."confirmed_at" IS '입교일'; COMMENT ON COLUMN "member"."previous_church" IS '이전 교회'; COMMENT ON COLUMN "member"."faith_years" IS '신앙 경력 (년)'; COMMENT ON COLUMN "member"."registration_reason" IS '등록 동기'; COMMENT ON COLUMN "member"."occupation" IS '직업'; COMMENT ON COLUMN "member"."address" IS '주소'; COMMENT ON COLUMN "member"."raw_donor_name" IS '봉투 원본 이름 (헌금 batch entry 매칭용)'`
    );
    await queryRunner.query(`CREATE INDEX "IDX_25cdb3d2e62238d3a342451de4" ON "member" ("church_id", "status_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_6d4f59ac9343c38e9d18c512f7" ON "member" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "member_department" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "member_id" integer NOT NULL, "department_id" integer NOT NULL, "start_date" date NOT NULL, "end_date" date, "is_leader" boolean NOT NULL DEFAULT false, "role_label" character varying, CONSTRAINT "PK_1f3d79a59e133f44e94db8e10a6" PRIMARY KEY ("id")); COMMENT ON COLUMN "member_department"."role_label" IS '리더 호칭 (부서장/부감/총무 등 free-form)'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3289f0dcd6a1bb3450aba23ad6" ON "member_department" ("member_id", "department_id") WHERE end_date IS NULL AND deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_c0f78a1ec9c6aa8ce617799edd" ON "member_department" ("department_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_899f32876d221ffe6e58124b35" ON "member_department" ("member_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_8521ba3d2a6c0e7e228670fb79" ON "member_department" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "member_ministry" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "member_id" integer NOT NULL, "ministry_id" integer NOT NULL, "start_date" date NOT NULL, "end_date" date, "is_leader" boolean NOT NULL DEFAULT false, "role_label" character varying, CONSTRAINT "PK_5f0afc141b59724bb6d5962206d" PRIMARY KEY ("id")); COMMENT ON COLUMN "member_ministry"."role_label" IS '리더 호칭 (팀장/부팀장 등 free-form)'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f733d0060bc92093bb9fae710e" ON "member_ministry" ("member_id", "ministry_id") WHERE end_date IS NULL AND deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_8ab5bc4b4456333128368a2fc4" ON "member_ministry" ("ministry_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_0fd61dc8c09833318fcecab6ca" ON "member_ministry" ("member_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_3b35f2e2583fa02e120727f416" ON "member_ministry" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "member_position" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "member_id" integer NOT NULL, "position_id" integer NOT NULL, "start_date" date NOT NULL, "end_date" date, "note" text, CONSTRAINT "PK_468d21997e6724b131ce1a9f9d9" PRIMARY KEY ("id")); COMMENT ON COLUMN "member_position"."note" IS '비고 (취임 경위 등)'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_d1c4d396be8026ded8d1e5915e" ON "member_position" ("member_id") WHERE end_date IS NULL AND deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_56bf8cdb3e3e11385e93f61971" ON "member_position" ("position_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_4b3e2863331d5523e85e9c0656" ON "member_position" ("member_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_0037dab95cf7bdfa9b959a6797" ON "member_position" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "member_small_group" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "member_id" integer NOT NULL, "small_group_id" integer NOT NULL, "start_date" date NOT NULL, "end_date" date, "is_leader" boolean NOT NULL DEFAULT false, "role_label" character varying, CONSTRAINT "PK_b6e7679c39acd17cbe02d5180d3" PRIMARY KEY ("id")); COMMENT ON COLUMN "member_small_group"."role_label" IS '리더 호칭 (목자/구역장 등 free-form)'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8e0e69b3f0fd7d9bd94d86efe4" ON "member_small_group" ("member_id", "small_group_id") WHERE end_date IS NULL AND deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_4baeaacd274da9360c0fdfd730" ON "member_small_group" ("small_group_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_2919540daaf3f08f060495ca47" ON "member_small_group" ("member_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_f0b1528fcfec4109a6ca08841e" ON "member_small_group" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "member_status" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying NOT NULL, "sort_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "system_key" character varying, "counts_in_roster" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_784d1a02d5886e56fec9dd33abe" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_14e6a6fb9a00b5482dff67a470" ON "member_status" ("church_id", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_82fc48bb500eab3837ceecb6d6" ON "member_status" ("church_id")`);
    await queryRunner.query(`CREATE TYPE "public"."membership_role_enum" AS ENUM('owner', 'admin', 'staff', 'viewer')`);
    await queryRunner.query(
      `CREATE TABLE "membership" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "account_id" integer NOT NULL, "church_id" integer NOT NULL, "role" "public"."membership_role_enum" NOT NULL DEFAULT 'staff', "member_id" integer, CONSTRAINT "PK_83c1afebef3059472e7c37e8de8" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE INDEX "IDX_4f57ae178a5c02ed6759f77c29" ON "membership" ("church_id")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9efe3a793286dd540af2d03cb8" ON "membership" ("account_id", "church_id") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(
      `CREATE TABLE "ministry" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "year" smallint NOT NULL, "name" character varying NOT NULL, "description" text, "sort_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_9279166bcd571de7497c6c667a4" PRIMARY KEY ("id")); COMMENT ON COLUMN "ministry"."year" IS '편성 연도'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_100cf5476adb07a74664a23fcb" ON "ministry" ("church_id", "year", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_2c074f15fae07009700a608759" ON "ministry" ("church_id", "year")`);
    await queryRunner.query(`CREATE INDEX "IDX_35c9c8f09f9ef9854bd911ea7a" ON "ministry" ("church_id")`);
    await queryRunner.query(
      `CREATE TYPE "public"."missionary_profile_stage_enum" AS ENUM('candidate', 'training', 'commissioned', 'field', 'furlough', 'returned', 'ended')`
    );
    await queryRunner.query(
      `CREATE TABLE "missionary_profile" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "member_id" integer NOT NULL, "stage" "public"."missionary_profile_stage_enum" NOT NULL DEFAULT 'candidate', "country" character varying, "region" character varying, "field_work" text, "ministry_id" integer, "commissioned_at" date, "departed_at" date, "ended_at" date, "note" text, CONSTRAINT "PK_d0ee91c8b61f5e6faa1b12da91f" PRIMARY KEY ("id")); COMMENT ON COLUMN "missionary_profile"."country" IS '파송 국가'; COMMENT ON COLUMN "missionary_profile"."region" IS '지역/도시'; COMMENT ON COLUMN "missionary_profile"."field_work" IS '사역 내용 요약'; COMMENT ON COLUMN "missionary_profile"."ministry_id" IS '소속 사역팀 (보통 해외선교팀)'; COMMENT ON COLUMN "missionary_profile"."commissioned_at" IS '파송 확정일'; COMMENT ON COLUMN "missionary_profile"."departed_at" IS '출국/현지 도착일'; COMMENT ON COLUMN "missionary_profile"."ended_at" IS '복귀/종료일'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_91db7b1b2bf1b0c66a0c5b6243" ON "missionary_profile" ("member_id") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_0f704d57b6547c92e697de8e13" ON "missionary_profile" ("church_id", "stage")`);
    await queryRunner.query(`CREATE INDEX "IDX_123740d147743d4e02b684af40" ON "missionary_profile" ("church_id")`);
    await queryRunner.query(
      `CREATE TYPE "public"."missionary_stage_history_from_stage_enum" AS ENUM('candidate', 'training', 'commissioned', 'field', 'furlough', 'returned', 'ended')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."missionary_stage_history_to_stage_enum" AS ENUM('candidate', 'training', 'commissioned', 'field', 'furlough', 'returned', 'ended')`
    );
    await queryRunner.query(
      `CREATE TABLE "missionary_stage_history" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "missionary_id" integer NOT NULL, "from_stage" "public"."missionary_stage_history_from_stage_enum", "to_stage" "public"."missionary_stage_history_to_stage_enum" NOT NULL, "changed_at" date NOT NULL, "recorder_account_id" integer NOT NULL, "note" text, CONSTRAINT "PK_c406df0be130a02220ed25b7a14" PRIMARY KEY ("id")); COMMENT ON COLUMN "missionary_stage_history"."from_stage" IS '이전 단계 (최초 등록 시 null)'; COMMENT ON COLUMN "missionary_stage_history"."recorder_account_id" IS '기록자 account'`
    );
    await queryRunner.query(`CREATE INDEX "IDX_6dc6216ddff5da80e33f7c677d" ON "missionary_stage_history" ("church_id", "changed_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_6c2793f6cbc1543c66f8b928e5" ON "missionary_stage_history" ("missionary_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_6aff9d3158ebe24cac90a30a22" ON "missionary_stage_history" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "offering" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "member_id" integer NOT NULL, "offering_category_id" integer NOT NULL, "worship_service_id" integer, "amount" bigint NOT NULL, "date" date NOT NULL, "raw_donor_name" character varying, "note" text, "recorder_account_id" integer NOT NULL, CONSTRAINT "PK_d42d2720ff82f75aae518b9347c" PRIMARY KEY ("id")); COMMENT ON COLUMN "offering"."member_id" IS '헌금자 성도'; COMMENT ON COLUMN "offering"."worship_service_id" IS '연결된 예배 (선택)'; COMMENT ON COLUMN "offering"."raw_donor_name" IS '봉투 원본 이름'; COMMENT ON COLUMN "offering"."recorder_account_id" IS '입력자 account'`
    );
    await queryRunner.query(`CREATE INDEX "IDX_102924999d7dc3f7abd481c4dc" ON "offering" ("offering_category_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_746c5c4d85cc9c950c78f60cc2" ON "offering" ("member_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_668406b2fa441070f4c5d884e9" ON "offering" ("church_id", "date")`);
    await queryRunner.query(`CREATE INDEX "IDX_0937e8f323a310427c9d6f956e" ON "offering" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "offering_category" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying NOT NULL, "description" text, "sort_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_cda768a04fc2a0cb408d6ebce5f" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7f424c6428ef0cb67f9396ab00" ON "offering_category" ("church_id", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_ddc954df715aab3045b5b6629d" ON "offering_category" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "photo" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "event_id" integer NOT NULL, "s3_key" character varying NOT NULL, "original_name" character varying NOT NULL, "content_type" character varying, "size" bigint, "uploader_account_id" integer NOT NULL, "sort_order" smallint NOT NULL DEFAULT '0', CONSTRAINT "PK_723fa50bf70dcfd06fb5a44d4ff" PRIMARY KEY ("id")); COMMENT ON COLUMN "photo"."s3_key" IS 'S3 object key'; COMMENT ON COLUMN "photo"."uploader_account_id" IS '업로더 account'`
    );
    await queryRunner.query(`CREATE INDEX "IDX_a5cae8ab915b11dee0d8742579" ON "photo" ("event_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_fad98c4a6b07b7266e1aef89b0" ON "photo" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "position" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying NOT NULL, "description" text, "sort_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_b7f483581562b4dc62ae1a5b7e2" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_399b28a05a69b198a6b02474de" ON "position" ("church_id", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_50d6ba97b246ca8ffb14b5c0cd" ON "position" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "small_group" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "year" smallint NOT NULL, "name" character varying NOT NULL, "description" text, "sort_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_89e27afcc0cc5198a7a1e0bdf10" PRIMARY KEY ("id")); COMMENT ON COLUMN "small_group"."year" IS '편성 연도'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ab72ce66e42c15aa95436162aa" ON "small_group" ("church_id", "year", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_9dae350bfef898134f6560e524" ON "small_group" ("church_id", "year")`);
    await queryRunner.query(`CREATE INDEX "IDX_3a69c23f4d87244acc81885e9a" ON "small_group" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "training_attendance" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "session_id" integer NOT NULL, "enrollment_id" integer NOT NULL, CONSTRAINT "PK_ec1cf074a9001ef4aa80a74bd61" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_58ff0d32851222ea7d270073be" ON "training_attendance" ("session_id", "enrollment_id") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_a71f948bcb16df406d37d5cf32" ON "training_attendance" ("enrollment_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_090affd9d04b9767b5fe2ace68" ON "training_attendance" ("session_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_31cd30f20c9b06aa1c2e77caff" ON "training_attendance" ("church_id")`);
    await queryRunner.query(`CREATE TYPE "public"."training_cohort_status_enum" AS ENUM('planned', 'ongoing', 'closed')`);
    await queryRunner.query(
      `CREATE TABLE "training_cohort" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "course_id" integer NOT NULL, "ordinal" smallint NOT NULL, "start_date" date NOT NULL, "end_date" date, "status" "public"."training_cohort_status_enum" NOT NULL DEFAULT 'planned', "leader_member_id" integer, "note" text, CONSTRAINT "PK_ac18deb67972c49380e56900bf2" PRIMARY KEY ("id")); COMMENT ON COLUMN "training_cohort"."ordinal" IS '기수 번호 (5기 → 5)'; COMMENT ON COLUMN "training_cohort"."end_date" IS '종료(예정)일'; COMMENT ON COLUMN "training_cohort"."leader_member_id" IS '담당 사역자 (member)'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5c63fbf6a4e845e92b010e411a" ON "training_cohort" ("course_id", "ordinal") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_3d70ea76ddc9b7f6e0c5afba14" ON "training_cohort" ("course_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_b9565243a519b9bebb0503c429" ON "training_cohort" ("church_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_7e8a2b7ba05e54730f469d71d1" ON "training_cohort" ("church_id")`);
    await queryRunner.query(`CREATE TYPE "public"."training_course_format_enum" AS ENUM('weekly', 'retreat', 'intensive', 'etc')`);
    await queryRunner.query(
      `CREATE TABLE "training_course" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying NOT NULL, "format" "public"."training_course_format_enum" NOT NULL DEFAULT 'weekly', "default_session_count" smallint NOT NULL DEFAULT '1', "description" text, "sort_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_56adcccf0f40e261ee7cac6c6b1" PRIMARY KEY ("id")); COMMENT ON COLUMN "training_course"."default_session_count" IS '기본 회차 수 — 기수 개설 시 회차 자동 생성에 사용'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1fa7e65e3db0648d41b0ea58a1" ON "training_course" ("church_id", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_f0d1e2333175c3b3b47baae366" ON "training_course" ("church_id")`);
    await queryRunner.query(`CREATE TYPE "public"."training_enrollment_status_enum" AS ENUM('enrolled', 'completed', 'dropped')`);
    await queryRunner.query(
      `CREATE TABLE "training_enrollment" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "cohort_id" integer NOT NULL, "member_id" integer NOT NULL, "status" "public"."training_enrollment_status_enum" NOT NULL DEFAULT 'enrolled', "enrolled_at" date NOT NULL, "closed_at" date, "note" text, CONSTRAINT "PK_e3f6b9339f05e60cfa3c83fa000" PRIMARY KEY ("id")); COMMENT ON COLUMN "training_enrollment"."closed_at" IS '수료(또는 중도포기) 확정일'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8c26cd6a940c51fc7c30d6bb8c" ON "training_enrollment" ("cohort_id", "member_id") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_72432cb3f767ba320acb9bbe56" ON "training_enrollment" ("member_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_5d4a441f2e9710c292a3981120" ON "training_enrollment" ("cohort_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_43bf5a47e3221a013ca6bbddb2" ON "training_enrollment" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "training_session" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "cohort_id" integer NOT NULL, "sequence" smallint NOT NULL, "date" date, "topic" character varying, CONSTRAINT "PK_a17a9657ff5a6e048bfd82c4651" PRIMARY KEY ("id")); COMMENT ON COLUMN "training_session"."sequence" IS '회차 번호 (1부터)'; COMMENT ON COLUMN "training_session"."topic" IS '주제/본문'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9221ced3c04cae7b971fa82a1e" ON "training_session" ("cohort_id", "sequence") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_ac4720af3b71cbf25185eaed23" ON "training_session" ("cohort_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_4329e6a05d4373d8b77ac99128" ON "training_session" ("church_id")`);
    await queryRunner.query(
      `CREATE TABLE "worship_service" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "id" SERIAL NOT NULL, "church_id" integer NOT NULL, "name" character varying NOT NULL, "description" text, "sort_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_b0c7ce6c7c32d47409458cce2cf" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6541a1bd67d1141c948fb5a979" ON "worship_service" ("church_id", "name") WHERE deleted_at IS NULL`
    );
    await queryRunner.query(`CREATE INDEX "IDX_3def9e835fb29773a77ea9c972" ON "worship_service" ("church_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "worship_service"`);
    await queryRunner.query(`DROP TABLE "training_session"`);
    await queryRunner.query(`DROP TABLE "training_enrollment"`);
    await queryRunner.query(`DROP TYPE "public"."training_enrollment_status_enum"`);
    await queryRunner.query(`DROP TABLE "training_course"`);
    await queryRunner.query(`DROP TYPE "public"."training_course_format_enum"`);
    await queryRunner.query(`DROP TABLE "training_cohort"`);
    await queryRunner.query(`DROP TYPE "public"."training_cohort_status_enum"`);
    await queryRunner.query(`DROP TABLE "training_attendance"`);
    await queryRunner.query(`DROP TABLE "small_group"`);
    await queryRunner.query(`DROP TABLE "position"`);
    await queryRunner.query(`DROP TABLE "photo"`);
    await queryRunner.query(`DROP TABLE "offering_category"`);
    await queryRunner.query(`DROP TABLE "offering"`);
    await queryRunner.query(`DROP TABLE "missionary_stage_history"`);
    await queryRunner.query(`DROP TYPE "public"."missionary_stage_history_from_stage_enum"`);
    await queryRunner.query(`DROP TYPE "public"."missionary_stage_history_to_stage_enum"`);
    await queryRunner.query(`DROP TABLE "missionary_profile"`);
    await queryRunner.query(`DROP TYPE "public"."missionary_profile_stage_enum"`);
    await queryRunner.query(`DROP TABLE "ministry"`);
    await queryRunner.query(`DROP TABLE "membership"`);
    await queryRunner.query(`DROP TYPE "public"."membership_role_enum"`);
    await queryRunner.query(`DROP TABLE "member_status"`);
    await queryRunner.query(`DROP TABLE "member_small_group"`);
    await queryRunner.query(`DROP TABLE "member_position"`);
    await queryRunner.query(`DROP TABLE "member_ministry"`);
    await queryRunner.query(`DROP TABLE "member_department"`);
    await queryRunner.query(`DROP TABLE "member"`);
    await queryRunner.query(`DROP TABLE "google_calendar_event_link"`);
    await queryRunner.query(`DROP TABLE "google_calendar_connection"`);
    await queryRunner.query(`DROP TABLE "fiscal_year"`);
    await queryRunner.query(`DROP TABLE "finance_transaction"`);
    await queryRunner.query(`DROP TYPE "public"."finance_transaction_flow_enum"`);
    await queryRunner.query(`DROP TABLE "event"`);
    await queryRunner.query(`DROP TABLE "department"`);
    await queryRunner.query(`DROP TABLE "church"`);
    await queryRunner.query(`DROP TYPE "public"."church_status_enum"`);
    await queryRunner.query(`DROP TABLE "care_note"`);
    await queryRunner.query(`DROP TYPE "public"."care_note_type_enum"`);
    await queryRunner.query(`DROP TABLE "calendar_subscription"`);
    await queryRunner.query(`DROP TABLE "calendar_event"`);
    await queryRunner.query(`DROP TABLE "calendar"`);
    await queryRunner.query(`DROP TABLE "budget_allocation"`);
    await queryRunner.query(`DROP TYPE "public"."budget_allocation_target_kind_enum"`);
    await queryRunner.query(`DROP TABLE "attendance"`);
    await queryRunner.query(`DROP TABLE "account_category"`);
    await queryRunner.query(`DROP TABLE "account"`);
  }
}
