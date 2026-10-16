import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 훈련 과정의 "수료 시 간사 등록 제안"을 없앤다 (2026-10-16 사용자).
 * 공동체 간사는 성도 단계의 다음 칸이 아니라 진입 경로(지원·면담·과정·헌신)가 따로라, 수료로 간사를 제안하면 틀린 그림이 된다.
 * 되돌리면 모두 false 로 돌아온다(어느 과정에 켜져 있었는지는 남지 않는다 — 기본 시드는 선교사학교 하나였다).
 */
export class DropCompletionSuggestsResident1788290000000 implements MigrationInterface {
  name = 'DropCompletionSuggestsResident1788290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "training_course" DROP COLUMN "completion_suggests_resident"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "training_course" ADD "completion_suggests_resident" boolean NOT NULL DEFAULT false`);
  }
}
