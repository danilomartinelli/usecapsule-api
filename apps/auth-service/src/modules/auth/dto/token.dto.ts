import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
} from 'class-validator';

import { UserRole } from '../../roles/domain/role.entity';

export class GenerateTokenDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class BlacklistTokenDto {
  @IsString()
  @IsNotEmpty()
  tokenId!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class TokenValidationDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class TokenResponseDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  refreshExpiresIn!: number;
  tokenType = 'Bearer';
}

export class TokenValidationResponseDto {
  isValid!: boolean;
  userId?: string;
  email?: string;
  role?: UserRole;
  expiresAt?: Date;
  error?: string;
}
