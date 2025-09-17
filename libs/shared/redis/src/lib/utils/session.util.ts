import type { Redis, Cluster } from 'ioredis';

/**
 * Session data interface
 */
export interface SessionData {
  /** Session ID */
  id: string;
  /** User ID associated with the session */
  userId?: string;
  /** Session creation timestamp */
  createdAt: number;
  /** Last access timestamp */
  lastAccessedAt: number;
  /** Session expiration timestamp */
  expiresAt: number;
  /** Custom session data */
  data: Record<string, unknown>;
  /** Client IP address */
  ip?: string;
  /** User agent string */
  userAgent?: string;
  /** Whether the session is persistent across browser sessions */
  persistent?: boolean;
}

/**
 * Session configuration options
 */
export interface SessionOptions {
  /** Key prefix for session storage */
  keyPrefix?: string;
  /** Default session TTL in seconds */
  defaultTTL?: number;
  /** Whether to extend session on access */
  rolling?: boolean;
  /** Maximum session duration in seconds */
  maxDuration?: number;
  /** Whether to track session metadata */
  trackMetadata?: boolean;
}

/**
 * Session manager utility for Redis-based session storage.
 *
 * This utility provides a high-level interface for managing user sessions
 * stored in Redis with support for TTL, rolling sessions, and metadata tracking.
 *
 * @example
 * ```typescript
 * const sessionManager = new SessionManager(redisClient, {
 *   keyPrefix: 'session:',
 *   defaultTTL: 3600,
 *   rolling: true
 * });
 *
 * // Create a new session
 * const session = await sessionManager.create('user123', {
 *   role: 'admin',
 *   permissions: ['read', 'write']
 * });
 *
 * // Get session data
 * const sessionData = await sessionManager.get(session.id);
 *
 * // Update session
 * await sessionManager.update(session.id, {
 *   lastLoginAt: Date.now()
 * });
 *
 * // Destroy session
 * await sessionManager.destroy(session.id);
 * ```
 */
export class SessionManager {
  private readonly options: Required<SessionOptions>;

  constructor(
    private readonly redisClient: Redis | Cluster,
    options: SessionOptions = {},
  ) {
    this.options = {
      keyPrefix: 'session:',
      defaultTTL: 3600, // 1 hour
      rolling: true,
      maxDuration: 24 * 60 * 60, // 24 hours
      trackMetadata: true,
      ...options,
    };
  }

  /**
   * Creates a new session for a user.
   *
   * @param userId - User ID to associate with the session
   * @param data - Initial session data
   * @param options - Session-specific options
   * @returns Promise that resolves to the created session
   */
  async create(
    userId?: string,
    data: Record<string, unknown> = {},
    options: {
      ttl?: number;
      persistent?: boolean;
      ip?: string;
      userAgent?: string;
    } = {},
  ): Promise<SessionData> {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    const ttl = options.ttl || this.options.defaultTTL;
    const expiresAt = now + ttl * 1000;

    const sessionData: SessionData = {
      id: sessionId,
      userId,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt,
      data,
      ip: options.ip,
      userAgent: options.userAgent,
      persistent: options.persistent || false,
    };

    const key = this.getSessionKey(sessionId);
    const serializedData = JSON.stringify(sessionData);

    await this.redisClient.setex(key, ttl, serializedData);

    // Track user sessions if userId is provided
    if (userId && this.options.trackMetadata) {
      await this.addToUserSessions(userId, sessionId, ttl);
    }

    return sessionData;
  }

  /**
   * Gets session data by session ID.
   *
   * @param sessionId - Session ID
   * @param touch - Whether to update last accessed time
   * @returns Promise that resolves to session data or null if not found
   */
  async get(sessionId: string, touch = true): Promise<SessionData | null> {
    const key = this.getSessionKey(sessionId);
    const data = await this.redisClient.get(key);

    if (!data) {
      return null;
    }

    try {
      const sessionData: SessionData = JSON.parse(data);

      // Check if session is expired
      if (sessionData.expiresAt <= Date.now()) {
        await this.destroy(sessionId);
        return null;
      }

      // Update last accessed time if touch is enabled
      if (touch) {
        sessionData.lastAccessedAt = Date.now();

        // Extend session TTL if rolling is enabled
        if (this.options.rolling) {
          const newTTL = this.calculateNewTTL(sessionData);
          sessionData.expiresAt = Date.now() + newTTL * 1000;

          const updatedData = JSON.stringify(sessionData);
          await this.redisClient.setex(key, newTTL, updatedData);

          // Update user sessions tracking
          if (sessionData.userId && this.options.trackMetadata) {
            await this.addToUserSessions(sessionData.userId, sessionId, newTTL);
          }
        } else {
          // Just update the session data without changing TTL
          const updatedData = JSON.stringify(sessionData);
          await this.redisClient.set(key, updatedData, 'KEEPTTL');
        }
      }

      return sessionData;
    } catch {
      // If session data is corrupted, destroy it
      await this.destroy(sessionId);
      return null;
    }
  }

  /**
   * Updates session data.
   *
   * @param sessionId - Session ID
   * @param data - Data to merge with existing session data
   * @returns Promise that resolves to true if session was updated
   */
  async update(
    sessionId: string,
    data: Record<string, unknown>,
  ): Promise<boolean> {
    const session = await this.get(sessionId, false);
    if (!session) {
      return false;
    }

    // Merge new data with existing data
    session.data = { ...session.data, ...data };
    session.lastAccessedAt = Date.now();

    const key = this.getSessionKey(sessionId);
    const ttl = await this.redisClient.ttl(key);

    if (ttl > 0) {
      const serializedData = JSON.stringify(session);
      await this.redisClient.setex(key, ttl, serializedData);
      return true;
    }

    return false;
  }

  /**
   * Destroys a session.
   *
   * @param sessionId - Session ID to destroy
   * @returns Promise that resolves to true if session was destroyed
   */
  async destroy(sessionId: string): Promise<boolean> {
    const session = await this.get(sessionId, false);
    const key = this.getSessionKey(sessionId);

    const result = await this.redisClient.del(key);

    // Remove from user sessions tracking
    if (session?.userId && this.options.trackMetadata) {
      await this.removeFromUserSessions(session.userId, sessionId);
    }

    return result > 0;
  }

  /**
   * Destroys all sessions for a user.
   *
   * @param userId - User ID
   * @returns Promise that resolves to the number of sessions destroyed
   */
  async destroyUserSessions(userId: string): Promise<number> {
    if (!this.options.trackMetadata) {
      throw new Error('User session tracking is disabled');
    }

    const sessionIds = await this.getUserSessions(userId);
    let destroyedCount = 0;

    for (const sessionId of sessionIds) {
      const destroyed = await this.destroy(sessionId);
      if (destroyed) {
        destroyedCount++;
      }
    }

    // Clean up user sessions set
    const userSessionsKey = this.getUserSessionsKey(userId);
    await this.redisClient.del(userSessionsKey);

    return destroyedCount;
  }

  /**
   * Gets all session IDs for a user.
   *
   * @param userId - User ID
   * @returns Promise that resolves to an array of session IDs
   */
  async getUserSessions(userId: string): Promise<string[]> {
    if (!this.options.trackMetadata) {
      return [];
    }

    const userSessionsKey = this.getUserSessionsKey(userId);
    return this.redisClient.smembers(userSessionsKey);
  }

  /**
   * Gets all active sessions for a user with their data.
   *
   * @param userId - User ID
   * @returns Promise that resolves to an array of session data
   */
  async getUserSessionsData(userId: string): Promise<SessionData[]> {
    const sessionIds = await this.getUserSessions(userId);
    const sessions: SessionData[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.get(sessionId, false);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Refreshes a session's TTL.
   *
   * @param sessionId - Session ID
   * @param ttl - New TTL in seconds (optional, uses default if not provided)
   * @returns Promise that resolves to true if session was refreshed
   */
  async refresh(sessionId: string, ttl?: number): Promise<boolean> {
    const session = await this.get(sessionId, false);
    if (!session) {
      return false;
    }

    const newTTL = ttl || this.options.defaultTTL;
    const key = this.getSessionKey(sessionId);

    // Update expiration time
    session.expiresAt = Date.now() + newTTL * 1000;
    session.lastAccessedAt = Date.now();

    const serializedData = JSON.stringify(session);
    await this.redisClient.setex(key, newTTL, serializedData);

    // Update user sessions tracking
    if (session.userId && this.options.trackMetadata) {
      await this.addToUserSessions(session.userId, sessionId, newTTL);
    }

    return true;
  }

  /**
   * Checks if a session exists and is valid.
   *
   * @param sessionId - Session ID
   * @returns Promise that resolves to true if session exists and is valid
   */
  async exists(sessionId: string): Promise<boolean> {
    const session = await this.get(sessionId, false);
    return session !== null;
  }

  /**
   * Gets session statistics.
   *
   * @returns Promise that resolves to session statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  }> {
    const pattern = `${this.options.keyPrefix}*`;
    const keys = await this.redisClient.keys(pattern);
    let activeSessions = 0;
    let expiredSessions = 0;

    for (const key of keys) {
      const ttl = await this.redisClient.ttl(key);
      if (ttl > 0) {
        activeSessions++;
      } else if (ttl === -2) {
        expiredSessions++;
      }
    }

    return {
      totalSessions: keys.length,
      activeSessions,
      expiredSessions,
    };
  }

  /**
   * Cleans up expired sessions.
   *
   * @returns Promise that resolves to the number of cleaned sessions
   */
  async cleanup(): Promise<number> {
    const pattern = `${this.options.keyPrefix}*`;
    const keys = await this.redisClient.keys(pattern);
    let cleanedCount = 0;

    for (const key of keys) {
      const ttl = await this.redisClient.ttl(key);
      if (ttl === -2) {
        // Key is expired but still exists
        await this.redisClient.del(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Generates a new session ID.
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0'),
    ).join('');
    return `${timestamp}.${randomBytes}`;
  }

  /**
   * Gets the Redis key for a session.
   */
  private getSessionKey(sessionId: string): string {
    return `${this.options.keyPrefix}${sessionId}`;
  }

  /**
   * Gets the Redis key for user sessions tracking.
   */
  private getUserSessionsKey(userId: string): string {
    return `${this.options.keyPrefix}user:${userId}:sessions`;
  }

  /**
   * Adds a session to user sessions tracking.
   */
  private async addToUserSessions(
    userId: string,
    sessionId: string,
    ttl: number,
  ): Promise<void> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    await this.redisClient.sadd(userSessionsKey, sessionId);
    await this.redisClient.expire(userSessionsKey, ttl + 60); // Extra 60 seconds buffer
  }

  /**
   * Removes a session from user sessions tracking.
   */
  private async removeFromUserSessions(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    await this.redisClient.srem(userSessionsKey, sessionId);
  }

  /**
   * Calculates new TTL for rolling sessions.
   */
  private calculateNewTTL(session: SessionData): number {
    const timeSinceCreation = Date.now() - session.createdAt;
    const maxDurationMs = this.options.maxDuration * 1000;

    if (timeSinceCreation >= maxDurationMs) {
      // Session has reached maximum duration
      return Math.max(
        60,
        this.options.defaultTTL - Math.floor(timeSinceCreation / 1000),
      );
    }

    return this.options.defaultTTL;
  }
}
