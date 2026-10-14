module.exports = {
  stage: process.env.NODE_ENV,
  postgresql: {
    type: 'postgresql',
    host: process.env.POSTGRES_DB_HOST,
    roHost: process.env.POSTGRES_DB_HOST_RO || process.env.POSTGRES_DB_HOST,
    port: Number(process.env.POSTGRES_DB_PORT || 5432),
    username: process.env.POSTGRES_DB_USERNAME,
    password: process.env.POSTGRES_DB_PASSWORD,
    database: process.env.POSTGRES_DB_NAME,
    // 외부 관리형 Postgres(Neon 등)는 SSL 필수. 로컬은 끈다.
    ssl: process.env.POSTGRES_DB_SSL === 'true',
    migrationsRun: true,
    entities: ['dist/src/database/entities/*.entity.js', 'dist/src/module/**/*.entity.js'],
    migrations: ['dist/src/database/migration/*.js'],
  },
  jwt: {
    access: {
      secretKey: process.env.JWT_CMS_ACCESS_SECRET_KEY,
      expired: '2h',
    },
    refresh: {
      secretKey: process.env.JWT_CMS_REFRESH_SECRET_KEY,
      expired: '30d',
    },
  },
  auth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
    },
  },
  web: {
    baseUrl: process.env.WEB_BASE_URL || '',
  },
  tokenEncryption: {
    // 구글 캘린더 토큰 암호화 키 — 운영에서 한 번 정하면 바꾸지 말 것 (바꾸면 연동을 다시 해야 한다)
    key: process.env.TOKEN_ENCRYPTION_KEY || '',
  },
  s3: {
    region: process.env.AWS_REGION || 'ap-northeast-2',
    bucket: process.env.AWS_S3_BUCKET || '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  cors: {
    origin: [/^[^\s.]+\.hyper-cloud\.kr$/, /^[^\s.]+\.hars\.kr$/, /([^\s.]+\.)?baraon\.kr$/, /^https:\/\/baraon\.kr$/],
  },
  cookie: {
    isSecure: true,
    domain: ['.hyper-cloud.kr', '.hars.kr', '.baraon.kr', 'baraon.kr'],
    prefix: '',
  },
  participation: {
    alphabet: 'lmUVWfg234zABopuvwxyYZ6789abcdIJK01PqrsCDX5LMNOntQRSTheEFGHijk',
  },
};
