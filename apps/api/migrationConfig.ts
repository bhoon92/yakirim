import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_DB_HOST ?? 'localhost',
  port: 5432,
  username: process.env.POSTGRES_DB_USERNAME ?? 'root',
  password: process.env.POSTGRES_DB_PASSWORD ?? 'root1234',
  database: process.env.POSTGRES_DB_NAME ?? 'yakirim',
  namingStrategy: new SnakeNamingStrategy(),
  entities: ['dist/src/database/entities/*.entity.js', 'dist/src/module/**/*.entity.js'],
  migrations: ['dist/src/database/migration/*.js'],
  synchronize: false,
});
