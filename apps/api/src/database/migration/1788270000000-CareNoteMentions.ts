import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 심방 기록 본문의 @멘션 — 언급한 교인 id 를 함께 저장한다.
 * 본문에는 "@이름" 글자만 남기고(내보내기·다른 화면에서도 그대로 읽히게) 연결은 이 배열이 들고 있다.
 * 언급된 사람의 교인 카드에 "다른 기록에서 언급됨"(노션의 백링크)을 보여주는 데 쓴다.
 */
export class CareNoteMentions1788270000000 implements MigrationInterface {
  name = 'CareNoteMentions1788270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "care_note" ADD "mentioned_member_ids" integer array NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`COMMENT ON COLUMN "care_note"."mentioned_member_ids" IS '본문에서 @ 로 언급한 교인 id'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "care_note" DROP COLUMN "mentioned_member_ids"`);
  }
}
