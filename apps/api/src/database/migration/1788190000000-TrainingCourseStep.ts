import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 훈련 과정에 사다리 속성을 붙인다 (planning 00.7 A·B).
 * - step: STEP 번호. null = 사다리 밖 과정
 * - completion_status_id: 수료 시 올리기를 제안할 재적상태
 * - completion_suggests_resident: 수료 시 간사 등록 제안
 *
 * 기존 과정에는 값을 채우지 않는다 — 과정은 교회가 화면에서 노션 선택지처럼 정리하기로 했다(2026-10-13).
 * 새 교회는 church-seed 가 기본 매핑을 넣는다.
 */
export class TrainingCourseStep1788190000000 implements MigrationInterface {
  name = 'TrainingCourseStep1788190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "training_course" ADD "step" smallint`);
    await queryRunner.query(`COMMENT ON COLUMN "training_course"."step" IS '훈련 사다리 단계 번호 (null = 사다리 밖)'`);
    await queryRunner.query(`ALTER TABLE "training_course" ADD "completion_status_id" integer`);
    await queryRunner.query(`COMMENT ON COLUMN "training_course"."completion_status_id" IS '수료 시 제안할 재적상태'`);
    await queryRunner.query(`ALTER TABLE "training_course" ADD "completion_suggests_resident" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`COMMENT ON COLUMN "training_course"."completion_suggests_resident" IS '수료 시 간사 등록 제안'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "training_course" DROP COLUMN "completion_suggests_resident"`);
    await queryRunner.query(`ALTER TABLE "training_course" DROP COLUMN "completion_status_id"`);
    await queryRunner.query(`ALTER TABLE "training_course" DROP COLUMN "step"`);
  }
}
