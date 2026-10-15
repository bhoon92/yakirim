// 테스트용 환경변수 — src/config.ts 가 import 시점에 설정을 읽어서 모듈을 불러오기 전에 채워야 한다.
// 로컬(.envrc)·CI 와 같은 접속값을 기본으로 쓰고, 이미 있는 값은 덮어쓰지 않는다.
// jest 가 NODE_ENV=test 를 미리 넣는데 config/test.js 는 없다 → localdev 설정으로 고정
process.env.NODE_ENV = 'localdev';
const defaults = {
  TZ: 'Asia/Seoul',
  POSTGRES_DB_HOST: 'localhost',
  POSTGRES_DB_USERNAME: 'root',
  POSTGRES_DB_PASSWORD: 'root1234',
  JWT_CMS_ACCESS_SECRET_KEY: 'test',
  JWT_CMS_REFRESH_SECRET_KEY: 'test',
  GOOGLE_CLIENT_ID: 'test',
  GOOGLE_CLIENT_SECRET: 'test',
};
for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) process.env[key] = value;
}
// 개발 DB(yakirim)를 건드리지 않도록 테스트는 항상 따로 만든 DB 를 쓴다
process.env.POSTGRES_DB_NAME = process.env.TEST_DB_NAME || 'yakirim_test';
