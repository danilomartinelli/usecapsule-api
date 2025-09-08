import { Module } from '@nestjs/common';
import { DatabaseModule } from '@usecapsule/database';
import { AUTH_DB_CONFIG } from '@usecapsule/database';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    DatabaseModule.forRoot(AUTH_DB_CONFIG),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
