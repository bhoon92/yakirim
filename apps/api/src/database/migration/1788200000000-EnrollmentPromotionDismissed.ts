import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 수료 제안 "넘기기" (planning 00.7 D).
 * 제안은 매번 계산하므로 넘긴 사실만 수강 기록에 남긴다. 기존 행은 null(= 아직 안 넘김).
 */
export class EnrollmentPromotionDismissed1788200000000 implements MigrationInterface {
  name = 'EnrollmentPromotionDismissed1788200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "training_enrollment" ADD "promotion_dismissed_at" date`);
    await queryRunner.query(`COMMENT ON COLUMN "training_enrollment"."promotion_dismissed_at" IS '수료 제안을 넘긴 날'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "training_enrollment" DROP COLUMN "promotion_dismissed_at"`);
  }
}
