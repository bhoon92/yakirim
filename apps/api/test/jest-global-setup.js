// 테스트 DB 를 매 실행마다 새로 만든다 — 이전 실행의 데이터가 결과를 바꾸지 않게.
// 마이그레이션은 각 테스트 파일이 setupTestDb() 에서 돌린다(이미 적용된 건 건너뛴다).
const { Client } = require('pg');

module.exports = async () => {
  const database = process.env.TEST_DB_NAME || 'yakirim_test';
  if (!/^[a-z_][a-z0-9_]*$/.test(database) || database === 'yakirim') {
    throw new Error(`테스트 DB 이름이 이상하다: ${database}`);
  }
  const client = new Client({
    host: process.env.POSTGRES_DB_HOST || 'localhost',
    user: process.env.POSTGRES_DB_USERNAME || 'root',
    password: process.env.POSTGRES_DB_PASSWORD || 'root1234',
    database: 'postgres',
  });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${database}"`);
  await client.end();
};
