import fs from 'fs';
import path from 'path';

const KEYS = [
  'NODE_ENV',
  'POSTGRES_DB_HOST',
  'POSTGRES_DB_HOST_RO',
  'POSTGRES_DB_USERNAME',
  'POSTGRES_DB_PASSWORD',
  'POSTGRES_DB_NAME',
  'JWT_CMS_ACCESS_SECRET_KEY',
  'JWT_CMS_REFRESH_SECRET_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'WEB_BASE_URL',
  'TOKEN_ENCRYPTION_KEY',
  'AWS_REGION',
  'AWS_S3_BUCKET',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
];

const lines = KEYS.filter(k => process.env[k] !== undefined).map(k => `${k}=${process.env[k]}`);

const outPath = path.resolve(__dirname, '..', '.env');
fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`[generateEnv] wrote ${lines.length} entries to ${outPath}`);
