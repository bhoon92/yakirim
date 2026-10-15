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
    entities: ['dist/src/database/entity/*.entity.js', 'dist/src/module/**/*.entity.js'],
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
      redirectUri: '/google/callback',
    },
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
