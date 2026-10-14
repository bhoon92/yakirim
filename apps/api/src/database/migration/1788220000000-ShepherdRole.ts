import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 역할에 "간사(shepherd)" 추가 (planning 00.7 권한 세분화).
 * 간사 대부분이 직접 로그인하는데 실무자(staff)로 초대하면 설정·간사 관리까지 바꿀 수 있었다.
 * 간사는 설정·간사·선교사 관리와 재정 수정·팀 관리를 뺀 나머지를 한다 (auth/permissions.ts).
 *
 * ADD VALUE 는 트랜잭션 안에서도 되지만 같은 트랜잭션에서 그 값을 쓸 수 없다 — 여기서는 쓰지 않는다.
 */
export class ShepherdRole1788220000000 implements MigrationInterface {
  name = 'ShepherdRole1788220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."membership_role_enum" ADD VALUE IF NOT EXISTS 'shepherd' BEFORE 'viewer'`);
  }

  /** enum 값은 뺄 수 없어 타입을 다시 만든다. 간사였던 계정은 실무자로 되돌린다. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "membership" SET "role" = 'staff' WHERE "role" = 'shepherd'`);
    await queryRunner.query(`ALTER TYPE "public"."membership_role_enum" RENAME TO "membership_role_enum_old"`);
    await queryRunner.query(`CREATE TYPE "public"."membership_role_enum" AS ENUM('owner', 'admin', 'staff', 'viewer')`);
    await queryRunner.query(`ALTER TABLE "membership" ALTER COLUMN "role" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "membership" ALTER COLUMN "role" TYPE "public"."membership_role_enum" USING "role"::"text"::"public"."membership_role_enum"`
    );
    await queryRunner.query(`ALTER TABLE "membership" ALTER COLUMN "role" SET DEFAULT 'staff'`);
    await queryRunner.query(`DROP TYPE "public"."membership_role_enum_old"`);
  }
}
