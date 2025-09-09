import { DynamicModule, Module, Provider } from '@nestjs/common';

import { createDatabasePool } from './database-pool.factory';
import { DATABASE_OPTIONS, DATABASE_POOL } from './database.constants';
import { DatabaseService } from './database.service';
import {
  DatabaseModuleAsyncOptions,
  DatabaseModuleOptions,
} from './interfaces';

@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    const databasePoolProvider: Provider = {
      provide: DATABASE_POOL,
      useFactory: () => createDatabasePool(options),
    };

    return {
      module: DatabaseModule,
      providers: [
        {
          provide: DATABASE_OPTIONS,
          useValue: options,
        },
        databasePoolProvider,
        DatabaseService,
      ],
      exports: [DatabaseService, DATABASE_POOL],
    };
  }

  static forRootAsync(options: DatabaseModuleAsyncOptions): DynamicModule {
    const databasePoolProvider: Provider = {
      provide: DATABASE_POOL,
      useFactory: async (config: DatabaseModuleOptions) => {
        return createDatabasePool(config);
      },
      inject: [DATABASE_OPTIONS],
    };

    const asyncProviders: Provider[] = [
      {
        provide: DATABASE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      databasePoolProvider,
      DatabaseService,
    ];

    return {
      module: DatabaseModule,
      imports: options.imports || [],
      providers: asyncProviders,
      exports: [DatabaseService, DATABASE_POOL],
    };
  }
}
