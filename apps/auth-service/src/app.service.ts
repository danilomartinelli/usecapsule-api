import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@usecapsule/database';
import { sql } from 'slonik';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async healthCheck() {
    const isDbHealthy = await this.databaseService.healthCheck();
    return {
      status: 'ok',
      service: 'auth-service',
      database: isDbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
    };
  }

  async validateToken(token: string) {
    this.logger.log(`Validating token: ${token.substring(0, 10)}...`);
    // TODO: Implement JWT validation logic
    return { valid: true, userId: 1 };
  }

  async login(email: string, password: string) {
    this.logger.log(`Login attempt for email: ${email}`);
    
    try {
      const pool = this.databaseService.getPool();
      const user = await pool.one(sql.typeAlias('user')`
        SELECT id, email, name, password_hash, is_active 
        FROM users 
        WHERE email = ${email} AND is_active = true
      `);

      // TODO: Implement proper password hashing and verification
      // For now, just return success for demo purposes
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        // TODO: Generate JWT token
        token: 'demo_jwt_token',
      };
    } catch (error) {
      this.logger.error(`Login failed for ${email}:`, error.message);
      return { success: false, error: 'Invalid credentials' };
    }
  }

  async register(email: string, password: string, name: string) {
    this.logger.log(`Registration attempt for email: ${email}`);
    
    try {
      const pool = this.databaseService.getPool();
      
      // TODO: Hash password properly
      const passwordHash = `hashed_${password}`;
      
      const user = await pool.one(sql.typeAlias('user')`
        INSERT INTO users (email, password_hash, name)
        VALUES (${email}, ${passwordHash}, ${name})
        RETURNING id, email, name, created_at
      `);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.created_at,
        },
      };
    } catch (error) {
      this.logger.error(`Registration failed for ${email}:`, error.message);
      return { success: false, error: 'Registration failed' };
    }
  }
}
