import { TransactionService } from './transaction.service';
import { ConfigProvider } from '@src/config';
import { DataSource, EntityManager } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export class DataSources {
  private static defaultInstance: DataSource;

  static get instance(): DataSource {
    if (!this.defaultInstance) {
      const connectionOptions: PostgresConnectionOptions = {
        ...ConfigProvider.postgresql,
      };
      const readOnlyConnectionOptions: PostgresConnectionOptions = {
        ...connectionOptions,
        host: ConfigProvider.postgresql.roHost,
      };

      this.defaultInstance = new DataSource({
        ...connectionOptions,
        replication: {
          master: connectionOptions,
          slaves: [readOnlyConnectionOptions],
        },
        name: 'default',
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
      });
    }
    return this.defaultInstance;
  }
  static setTestInstance(testInstance: DataSource) {
    this.defaultInstance = testInstance;
  }
}

export function getEntityManager(source?: EntityManager | TransactionService | DataSource): EntityManager | DataSource {
  if (source instanceof TransactionService) {
    return source.getTransaction() ?? DataSources.instance;
  }
  return source ?? DataSources.instance;
}
