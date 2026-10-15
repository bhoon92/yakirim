import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * care_note_type 인덱스 이름을 TypeORM 이 엔티티에서 계산하는 이름으로 맞춘다 (구성·조건은 그대로).
 * 1788160000000 에서 손으로 지은 이름을 써서, migration:generate 가 매번 "지우고 다시 만들기"를 제안했다.
 * CI 의 스키마 드리프트 검사(migration:generate --check)가 이것 때문에 늘 실패하므로 이름만 바꾼다.
 */
export class CareNoteTypeIndexNames1788240000000 implements MigrationInterface {
  name = 'CareNoteTypeIndexNames1788240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER INDEX "public"."IDX_5a1b6b0f9f4f7c9d3e2a8b7c6d" RENAME TO "IDX_4f6e8458fb1359a35ef822980f"`);
    await queryRunner.query(`ALTER INDEX "public"."IDX_7c3d9e1a4b5f6a2c8d0e3f1b9a" RENAME TO "IDX_2e5df0e2cfb559057782c19ce9"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER INDEX "public"."IDX_2e5df0e2cfb559057782c19ce9" RENAME TO "IDX_7c3d9e1a4b5f6a2c8d0e3f1b9a"`);
    await queryRunner.query(`ALTER INDEX "public"."IDX_4f6e8458fb1359a35ef822980f" RENAME TO "IDX_5a1b6b0f9f4f7c9d3e2a8b7c6d"`);
  }
}
