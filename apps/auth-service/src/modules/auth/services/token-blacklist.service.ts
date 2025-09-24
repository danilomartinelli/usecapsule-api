import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AuthServiceSchema } from '@usecapsule/parameters';
import Redis from 'ioredis';

export interface BlacklistedToken {
  jti: string; // JWT ID
  userId: string;
  blacklistedAt: Date;
  expiresAt: Date;
  reason?: string;
}

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly redis: Redis;
  private readonly keyPrefix = 'auth:blacklist:';

  constructor(
    private readonly configService: ConfigService<AuthServiceSchema>,
  ) {
    const redisHost =
      this.configService.get('REDIS_HOST', { infer: true }) || 'localhost';
    const redisPort =
      this.configService.get('REDIS_PORT', { infer: true }) || 6379;
    const redisDb = this.configService.get('REDIS_DB', { infer: true }) || 0;

    this.redis = new Redis({
      host: redisHost,
      port: Number(redisPort),
      db: Number(redisDb),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis for token blacklisting');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });
  }

  async blacklistToken(
    tokenId: string,
    userId: string,
    expiresAt: Date,
    reason?: string,
  ): Promise<boolean> {
    try {
      const blacklistedToken: BlacklistedToken = {
        jti: tokenId,
        userId,
        blacklistedAt: new Date(),
        expiresAt,
        reason,
      };

      const key = this.getTokenKey(tokenId);
      const ttlSeconds = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);

      // Only set TTL if the token hasn't already expired
      if (ttlSeconds > 0) {
        await this.redis.setex(
          key,
          ttlSeconds,
          JSON.stringify(blacklistedToken),
        );

        this.logger.debug(
          `Token ${tokenId} blacklisted for user ${userId}, TTL: ${ttlSeconds}s`,
        );
        return true;
      } else {
        this.logger.debug(
          `Token ${tokenId} already expired, not adding to blacklist`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error('Failed to blacklist token:', error);
      return false;
    }
  }

  async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    try {
      const key = this.getTokenKey(tokenId);
      const result = await this.redis.get(key);
      return result !== null;
    } catch (error) {
      this.logger.error('Failed to check token blacklist status:', error);
      // Fail secure: if we can't check, assume blacklisted
      return true;
    }
  }

  async getBlacklistedTokenInfo(
    tokenId: string,
  ): Promise<BlacklistedToken | null> {
    try {
      const key = this.getTokenKey(tokenId);
      const result = await this.redis.get(key);

      if (!result) return null;

      return JSON.parse(result) as BlacklistedToken;
    } catch (error) {
      this.logger.error('Failed to get blacklisted token info:', error);
      return null;
    }
  }

  async blacklistAllUserTokens(
    userId: string,
    reason?: string,
  ): Promise<number> {
    try {
      // Use a pattern to find all tokens for this user
      const userPattern = `${this.keyPrefix}user:${userId}:*`;
      const keys = await this.redis.keys(userPattern);

      if (keys.length === 0) {
        this.logger.debug(`No tokens found for user ${userId}`);
        return 0;
      }

      // Get all token data
      const tokenData = await this.redis.mget(keys);
      let blacklistedCount = 0;

      for (let i = 0; i < keys.length; i++) {
        const data = tokenData[i];
        if (data) {
          try {
            const token: BlacklistedToken = JSON.parse(data);
            token.reason = reason || 'User logout/security action';
            token.blacklistedAt = new Date();

            await this.redis.set(keys[i], JSON.stringify(token));
            blacklistedCount++;
          } catch {
            this.logger.warn(`Failed to parse token data for key ${keys[i]}`);
          }
        }
      }

      this.logger.log(
        `Blacklisted ${blacklistedCount} tokens for user ${userId}`,
      );
      return blacklistedCount;
    } catch (error) {
      this.logger.error('Failed to blacklist all user tokens:', error);
      return 0;
    }
  }

  async cleanupExpiredTokens(): Promise<number> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) return 0;

      let cleanedCount = 0;
      const now = new Date();

      for (const key of keys) {
        try {
          const data = await this.redis.get(key);
          if (data) {
            const token: BlacklistedToken = JSON.parse(data);
            if (new Date(token.expiresAt) < now) {
              await this.redis.del(key);
              cleanedCount++;
            }
          }
        } catch {
          // If we can't parse the token data, remove it
          await this.redis.del(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(
          `Cleaned up ${cleanedCount} expired blacklisted tokens`,
        );
      }

      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired tokens:', error);
      return 0;
    }
  }

  async getBlacklistedTokenCount(): Promise<number> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);
      return keys.length;
    } catch (error) {
      this.logger.error('Failed to get blacklisted token count:', error);
      return 0;
    }
  }

  async getUserBlacklistedTokens(userId: string): Promise<BlacklistedToken[]> {
    try {
      const userPattern = `${this.keyPrefix}user:${userId}:*`;
      const keys = await this.redis.keys(userPattern);

      if (keys.length === 0) return [];

      const tokenData = await this.redis.mget(keys);
      const tokens: BlacklistedToken[] = [];

      for (const data of tokenData) {
        if (data) {
          try {
            tokens.push(JSON.parse(data) as BlacklistedToken);
          } catch {
            this.logger.warn('Failed to parse blacklisted token data');
          }
        }
      }

      return tokens;
    } catch (error) {
      this.logger.error('Failed to get user blacklisted tokens:', error);
      return [];
    }
  }

  private getTokenKey(tokenId: string): string {
    return `${this.keyPrefix}${tokenId}`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
    this.logger.log('Redis connection closed');
  }
}
