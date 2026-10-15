module.exports = {
  stage: process.env.NODE_ENV,
  postgresql: {
    type: 'postgresql',
    host: process.env.POSTGRES_DB_HOST,
    roHost: process.env.POSTGRES_DB_HOST_RO || process.env.POSTGRES_DB_HOST,
    port: 5432,
    username: process.env.POSTGRES_DB_USERNAME,
    password: process.env.POSTGRES_DB_PASSWORD,
    database: process.env.POSTGRES_DB_NAME,
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
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/api/auth/google/callback',
    },
  },
  web: {
    baseUrl: process.env.WEB_BASE_URL || 'http://localhost:5173',
  },
  tokenEncryption: {
    key: process.env.TOKEN_ENCRYPTION_KEY || 'local-dev-token-encryption-key',
  },
  s3: {
    region: process.env.AWS_REGION || 'ap-northeast-2',
    bucket: process.env.AWS_S3_BUCKET || 'yakirim-photos',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  cors: {
    origin: ['http://localhost:5173'],
  },
  cookie: {
    isSecure: false,
    domain: [],
    prefix: '',
  },
  participation: {
    alphabet: 'lmUVWfg234zABopuvwxyYZ6789abcdIJK01PqrsCDX5LMNOntQRSTheEFGHijk',
  },
};
