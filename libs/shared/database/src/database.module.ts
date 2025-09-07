import { Module, DynamicModule } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseConfig } from './database.config';

@Module({})
export class DatabaseModule {
  static forRoot(config: DatabaseConfig): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: 'DATABASE_CONFIG',
          useValue: config,
        },
        DatabaseService,
      ],
      exports: [DatabaseService],
      global: true,
    };
  }
}