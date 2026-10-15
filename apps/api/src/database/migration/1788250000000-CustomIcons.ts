import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 훈련 과정 · 달력 레이어 · 갤러리 행사에 직접 고른 아이콘(이모지).
 * 지금까지는 이름 해시로 자동 배정(web lib/tile.ts)만 했다 — null 이면 그대로 자동.
 * 길이 16: 국기·가족 같은 조합 이모지가 UTF-16 으로 11자 안팎이다.
 */
export class CustomIcons1788250000000 implements MigrationInterface {
  name = 'CustomIcons1788250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['training_course', 'calendar', 'event']) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "icon" character varying(16)`);
      await queryRunner.query(`COMMENT ON COLUMN "${table}"."icon" IS '직접 고른 아이콘(이모지). null 이면 이름으로 자동 배정'`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['training_course', 'calendar', 'event']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "icon"`);
    }
  }
}
