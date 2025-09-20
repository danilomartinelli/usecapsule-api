import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService as NestJwtService } from '@nestjs/jwt';
import type { AuthServiceSchema } from '@usecapsule/parameters';

import type { UserRole } from '../../roles/domain/role.entity';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

@Injectable()
export class JwtService {
  private readonly logger = new Logger(JwtService.name);
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly jwtSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly nestJwtService: NestJwtService,
    private readonly configService: ConfigService<AuthServiceSchema>,
  ) {
    this.accessTokenExpiry =
      this.configService.get('JWT_EXPIRATION', {
        infer: true,
      }) || '15m';
    this.refreshTokenExpiry = '7d'; // Fixed value for refresh tokens
    this.jwtSecret =
      this.configService.get('JWT_SECRET', { infer: true }) || '';
    this.refreshSecret =
      this.configService.get('JWT_SECRET', {
        infer: true,
      }) + '_refresh' || 'default_refresh_secret';

    if (!this.jwtSecret || !this.refreshSecret) {
      throw new Error('JWT secrets must be configured');
    }
  }

  async generateTokenPair(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<TokenPair> {
    try {
      const accessPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: userId,
        email,
        role,
        type: 'access',
      };

      const refreshPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: userId,
        email,
        role,
        type: 'refresh',
      };

      const [accessToken, refreshToken] = await Promise.all([
        this.nestJwtService.signAsync(accessPayload, {
          secret: this.jwtSecret,
          expiresIn: this.accessTokenExpiry,
        }),
        this.nestJwtService.signAsync(refreshPayload, {
          secret: this.refreshSecret,
          expiresIn: this.refreshTokenExpiry,
        }),
      ]);

      const accessExpiresIn = this.parseExpiryToSeconds(this.accessTokenExpiry);
      const refreshExpiresIn = this.parseExpiryToSeconds(
        this.refreshTokenExpiry,
      );

      this.logger.debug(`Generated token pair for user ${userId}`);

      return {
        accessToken,
        refreshToken,
        expiresIn: accessExpiresIn,
        refreshExpiresIn,
      };
    } catch (error) {
      this.logger.error('Failed to generate token pair:', error);
      throw new Error('Token generation failed');
    }
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.nestJwtService.verifyAsync<JwtPayload>(token, {
        secret: this.jwtSecret,
      });

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      this.logger.error('Access token verification failed:', error);
      throw new Error('Invalid access token');
    }
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.nestJwtService.verifyAsync<JwtPayload>(token, {
        secret: this.refreshSecret,
      });

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      this.logger.error('Refresh token verification failed:', error);
      throw new Error('Invalid refresh token');
    }
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = await this.verifyRefreshToken(refreshToken);

      return this.generateTokenPair(payload.sub, payload.email, payload.role);
    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      throw new Error('Token refresh failed');
    }
  }

  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) return null;

    return token;
  }

  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = this.nestJwtService.decode(token) as JwtPayload;
      if (!decoded || !decoded.exp) return null;

      return new Date(decoded.exp * 1000);
    } catch (error) {
      this.logger.error('Failed to decode token:', error);
      return null;
    }
  }

  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;

    return new Date() > expiration;
  }

  private parseExpiryToSeconds(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return parseInt(expiry, 10); // assume seconds if no unit
    }
  }
}
