import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { ValueTransformer } from 'typeorm';
import { ConfigProvider } from '@src/config';

/**
 * 외부 서비스 토큰(구글 캘린더 refresh/access token)을 DB 에 넣을 때 쓰는 AES-256-GCM 암호화.
 * 저장 형식: `enc:v1:<iv>:<tag>:<암호문>` (각각 base64).
 *
 * 키(TOKEN_ENCRYPTION_KEY)를 바꾸면 이미 저장된 토큰은 풀 수 없다 — 연동을 다시 해야 한다.
 * 키가 없으면 부팅은 되고, 토큰을 읽거나 쓰는 순간에만 실패한다(연동을 안 쓰는 환경을 막지 않으려고).
 */
const PREFIX = 'enc:v1:';

function key(): Buffer {
  const secret = ConfigProvider.tokenEncryption.key;
  if (!secret) throw new Error('TOKEN_ENCRYPTION_KEY 가 설정되지 않아 토큰을 암호화/복호화할 수 없습니다');
  // 어떤 길이의 문자열이 와도 32바이트 키가 되도록
  return createHash('sha256').update(secret).digest();
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), body].map(b => b.toString('base64')).join(':');
}

export function decryptToken(stored: string): string {
  // 암호화 도입 전에 평문으로 저장된 값 — 다음에 토큰이 바뀌어 저장될 때 암호화된다
  if (!stored.startsWith(PREFIX)) return stored;
  const [iv, tag, body] = stored
    .slice(PREFIX.length)
    .split(':')
    .map(s => Buffer.from(s, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

/** `@Column({ transformer: encryptedText })` — 빈 값('', null)은 그대로 둔다. */
export const encryptedText: ValueTransformer = {
  to: (value?: string | null) => (value ? encryptToken(value) : value),
  from: (value?: string | null) => (value ? decryptToken(value) : value),
};
