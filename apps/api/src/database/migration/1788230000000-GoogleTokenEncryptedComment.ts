import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 구글 캘린더 토큰 컬럼 설명만 바꾼다 — 암호화는 엔티티의 transformer(util/token-cipher)가 한다.
 * 기존 평문 행은 그대로 읽히고, 토큰이 다시 저장될 때 암호화된다(로컬은 이 시점 연동 0건).
 */
export class GoogleTokenEncryptedComment1788230000000 implements MigrationInterface {
  name = 'GoogleTokenEncryptedComment1788230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "google_calendar_connection"."refresh_token" IS 'offline refresh token (AES-256-GCM 암호화)'`
    );
    await queryRunner.query(`COMMENT ON COLUMN "google_calendar_connection"."access_token" IS '캐시된 access token (AES-256-GCM 암호화)'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "google_calendar_connection"."refresh_token" IS 'offline refresh token (평문, 암호화 TODO)'`
    );
    await queryRunner.query(`COMMENT ON COLUMN "google_calendar_connection"."access_token" IS '캐시된 access token'`);
  }
}
