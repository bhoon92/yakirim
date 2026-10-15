import fs from 'fs';
import path from 'path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { DataSources } from '@src/database/data-sources';
import { ChurchEntity } from '@src/database/entities/church.entity';

/** 디렉터리의 .ts 파일을 불러와 내보낸 클래스를 모은다 (jest 안에서 ts-jest 로 변환된다). */
function classesIn(dir: string, suffix: string): (new (...args: unknown[]) => unknown)[] {
  return (
    fs
      .readdirSync(dir)
      .filter(file => file.endsWith(suffix))
      .sort()
      // 파일 목록이 실행 시점에 정해져서 정적 import 로 쓸 수 없다
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      .flatMap(file => Object.values(require(path.join(dir, file)) as Record<string, unknown>))
      .filter((value): value is new (...args: unknown[]) => unknown => typeof value === 'function')
  );
}

/**
 * 실제 Postgres 테스트 DB 에 붙고 마이그레이션을 끝까지 돌린 뒤, 서비스들이 쓰는 DataSources.instance 로 끼운다.
 * 이 프로젝트의 핵심 로직은 SQL 에 있어서(정체 판정·부분 유니크 인덱스·회차 재정렬) mock 으로는 검증이 안 된다.
 * DB 는 jest-global-setup 이 매 실행마다 새로 만든다.
 */
export async function setupTestDb(): Promise<DataSource> {
  const database = path.join(__dirname, '..', 'database');
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_DB_HOST,
    port: 5432,
    username: process.env.POSTGRES_DB_USERNAME,
    password: process.env.POSTGRES_DB_PASSWORD,
    database: process.env.POSTGRES_DB_NAME,
    namingStrategy: new SnakeNamingStrategy(),
    entities: classesIn(path.join(database, 'entities'), '.entity.ts'),
    migrations: classesIn(path.join(database, 'migration'), '.ts'),
    synchronize: false,
  });
  await dataSource.initialize();
  await dataSource.runMigrations({ transaction: 'each' });
  DataSources.setTestInstance(dataSource);
  return dataSource;
}

/** 테스트마다 교회를 새로 만든다 — 모든 데이터가 church_id 로 갈려서 테스트끼리 섞이지 않는다. */
export async function newChurch(dataSource: DataSource): Promise<number> {
  const repo = dataSource.getRepository(ChurchEntity);
  const church = await repo.save(repo.create({ name: `테스트교회 ${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }));
  return church.id;
}
