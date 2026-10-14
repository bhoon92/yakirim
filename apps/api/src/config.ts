import { CustomOrigin } from '@nestjs/common/interfaces/external/cors-options.interface';
import config from 'config';
import { ManipulateType } from 'dayjs';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

type StaticOrigin = boolean | string | RegExp | (string | RegExp)[];

export const ConfigProvider = {
  stage: config.get<string>('stage'),
  postgresql: {
    type: 'postgres',
    host: config.get<string>('postgresql.host'),
    roHost: config.get<string>('postgresql.roHost'),
    port: config.get<number>('postgresql.port'),
    username: config.get<string>('postgresql.username'),
    password: config.get<string>('postgresql.password'),
    database: config.get<string>('postgresql.database'),
    ssl: config.get<boolean>('postgresql.ssl'),
    logger: 'debug',
    logging: true,
    migrationsRun: config.get<boolean>('postgresql.migrationsRun'),
    synchronize: false,
    entities: config.get<string[]>('postgresql.entities'),
    migrations: config.get<string[]>('postgresql.migrations'),
  } as PostgresConnectionOptions & { roHost: string },
  jwt: {
    access: {
      secret: config.get<string>('jwt.access.secretKey'),
      expiresIn: config.get<string>('jwt.access.expired'),
    },
    refresh: {
      secret: config.get<string>('jwt.refresh.secretKey'),
      expiresIn: config.get<string>('jwt.refresh.expired'),
    },
  },
  auth: {
    google: config.get<{ clientId: string; clientSecret: string; redirectUri: string }>('auth.google'),
  },
  web: {
    baseUrl: config.get<string>('web.baseUrl'),
  },
  s3: {
    region: config.get<string>('s3.region'),
    bucket: config.get<string>('s3.bucket'),
    accessKeyId: config.get<string>('s3.accessKeyId'),
    secretAccessKey: config.get<string>('s3.secretAccessKey'),
  },
  cors: {
    origin: config.get<StaticOrigin | CustomOrigin>('cors.origin'),
  },
  cookie: {
    isSecure: config.get<boolean>('cookie.isSecure'),
    domain: config.get<string[]>('cookie.domain'),
    prefix: config.get<string>('cookie.prefix'),
  },
  policy: {
    passwordReset: {
      expiredAt: {
        value: 10,
        unit: 'm' as ManipulateType,
      },
    },
  },
} as const;
