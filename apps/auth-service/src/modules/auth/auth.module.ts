import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { AuthServiceSchema } from '@usecapsule/parameters';

import { JwtService as CustomJwtService } from './services/jwt.service';
import { PasswordService } from './services/password.service';
import { TokenBlacklistService } from './services/token-blacklist.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AuthServiceSchema>) => ({
        secret: configService.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn:
            configService.get('JWT_EXPIRATION', { infer: true }) || '15m',
        },
      }),
    }),
  ],
  providers: [PasswordService, CustomJwtService, TokenBlacklistService],
  exports: [
    PasswordService,
    CustomJwtService,
    TokenBlacklistService,
    JwtModule,
  ],
})
export class AuthModule {}
