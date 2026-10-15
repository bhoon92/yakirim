import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 조직 대분류(기관·사역팀·공동체)의 교회별 표시 이름.
 *
 * 대분류는 3종 고정이지만 부르는 이름은 교회마다 다르다(부서/구역/목장/셀…).
 * null 이면 코드 기본값을 쓰므로 기존 교회는 아무 것도 바뀌지 않는다.
 */
export class ChurchOrganizationLabels1787897839931 implements MigrationInterface {
  name = 'ChurchOrganizationLabels1787897839931';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "church" ADD "department_label" character varying`);
    await queryRunner.query(`COMMENT ON COLUMN "church"."department_label" IS '기관 대분류의 교회별 표시 이름'`);
    await queryRunner.query(`ALTER TABLE "church" ADD "ministry_label" character varying`);
    await queryRunner.query(`COMMENT ON COLUMN "church"."ministry_label" IS '사역팀 대분류의 교회별 표시 이름'`);
    await queryRunner.query(`ALTER TABLE "church" ADD "small_group_label" character varying`);
    await queryRunner.query(`COMMENT ON COLUMN "church"."small_group_label" IS '공동체 대분류의 교회별 표시 이름'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON COLUMN "church"."small_group_label" IS '공동체 대분류의 교회별 표시 이름'`);
    await queryRunner.query(`ALTER TABLE "church" DROP COLUMN "small_group_label"`);
    await queryRunner.query(`COMMENT ON COLUMN "church"."ministry_label" IS '사역팀 대분류의 교회별 표시 이름'`);
    await queryRunner.query(`ALTER TABLE "church" DROP COLUMN "ministry_label"`);
    await queryRunner.query(`COMMENT ON COLUMN "church"."department_label" IS '기관 대분류의 교회별 표시 이름'`);
    await queryRunner.query(`ALTER TABLE "church" DROP COLUMN "department_label"`);
  }
}
