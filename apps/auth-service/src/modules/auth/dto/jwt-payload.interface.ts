import type { UserRole } from '../../roles/domain/role.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface TokenValidationResult {
  isValid: boolean;
  payload?: JwtPayload;
  error?: string;
}

export interface TokenBlacklistInfo {
  jti: string;
  userId: string;
  blacklistedAt: Date;
  expiresAt: Date;
  reason?: string;
}
