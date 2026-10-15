import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 양육기록 종류에 `visit`(심방) 추가.
 *
 * 생성기에 맡기지 않고 손으로 썼다 — `migrationsRun: true` 라 파일이 생기는 순간 watch 서버가
 * 초안을 그대로 실행해 버리기 때문이다(HANDOFF §3.1).
 *
 * `ALTER TYPE ... ADD VALUE` 대신 **타입을 새로 만들어 갈아끼우는** TypeORM 방식으로 간다.
 * ADD VALUE 는 같은 트랜잭션 안에서 새 값을 쓸 수 없다는 제약이 있어 마이그레이션에서 다루기 번거롭고,
 * 값 순서도 지정할 수 없다(심방을 맨 앞에 두고 싶다).
 */
export class CareNoteVisitType1788150000000 implements MigrationInterface {
  name = 'CareNoteVisitType1788150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "care_note" ALTER COLUMN "type" DROP DEFAULT`);
    await queryRunner.query(`ALTER TYPE "public"."care_note_type_enum" RENAME TO "care_note_type_enum_old"`);
    await queryRunner.query(
      `CREATE TYPE "public"."care_note_type_enum" AS ENUM('visit', 'meeting', 'nurture', 'counsel', 'field_report', 'etc')`
    );
    await queryRunner.query(
      `ALTER TABLE "care_note" ALTER COLUMN "type" TYPE "public"."care_note_type_enum" USING "type"::"text"::"public"."care_note_type_enum"`
    );
    await queryRunner.query(`ALTER TABLE "care_note" ALTER COLUMN "type" SET DEFAULT 'meeting'`);
    await queryRunner.query(`DROP TYPE "public"."care_note_type_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 되돌리려면 심방 기록이 남아 있으면 안 된다 — 값이 사라지면 캐스팅이 실패한다.
    await queryRunner.query(`UPDATE "care_note" SET "type" = 'meeting' WHERE "type" = 'visit'`);
    await queryRunner.query(`ALTER TABLE "care_note" ALTER COLUMN "type" DROP DEFAULT`);
    await queryRunner.query(`ALTER TYPE "public"."care_note_type_enum" RENAME TO "care_note_type_enum_old"`);
    await queryRunner.query(`CREATE TYPE "public"."care_note_type_enum" AS ENUM('meeting', 'nurture', 'counsel', 'field_report', 'etc')`);
    await queryRunner.query(
      `ALTER TABLE "care_note" ALTER COLUMN "type" TYPE "public"."care_note_type_enum" USING "type"::"text"::"public"."care_note_type_enum"`
    );
    await queryRunner.query(`ALTER TABLE "care_note" ALTER COLUMN "type" SET DEFAULT 'meeting'`);
    await queryRunner.query(`DROP TYPE "public"."care_note_type_enum_old"`);
  }
}
