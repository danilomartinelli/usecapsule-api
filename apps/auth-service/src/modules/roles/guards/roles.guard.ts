import type { CanActivate, ExecutionContext } from '@nestjs/common';
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import type { Permission } from '../domain/role.entity';
import { UserRole } from '../domain/role.entity';
import type { RoleService } from '../services/role.service';

import { ROLES_KEY, PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly roleService: RoleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles or permissions are required, allow access
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      this.logger.warn('No user found in request context');
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = user.sub;

    try {
      // Check role requirements
      if (requiredRoles && requiredRoles.length > 0) {
        const userRole = await this.roleService.getUserRole(userId);

        if (!userRole) {
          this.logger.warn(`User ${userId} has no assigned role`);
          throw new ForbiddenException('User has no assigned role');
        }

        if (!requiredRoles.includes(userRole.role)) {
          this.logger.warn(
            `User ${userId} with role ${userRole.role} attempted to access endpoint requiring roles: ${requiredRoles.join(', ')}`,
          );
          throw new ForbiddenException('Insufficient role permissions');
        }
      }

      // Check permission requirements
      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasAllPermissions = await this.roleService.hasAllPermissions(
          userId,
          requiredPermissions,
        );

        if (!hasAllPermissions) {
          const userPermissions =
            await this.roleService.getUserPermissions(userId);
          this.logger.warn(
            `User ${userId} with permissions [${userPermissions.join(', ')}] attempted to access endpoint requiring permissions: [${requiredPermissions.join(', ')}]`,
          );
          throw new ForbiddenException('Insufficient permissions');
        }
      }

      this.logger.debug(`Access granted for user ${userId}`);
      return true;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error('Error during role/permission check:', error);
      throw new ForbiddenException('Authorization check failed');
    }
  }
}

@Injectable()
export class MinimumRoleGuard implements CanActivate {
  private readonly logger = new Logger(MinimumRoleGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly roleService: RoleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const minimumRole = this.reflector.getAllAndOverride<UserRole>(
      'minimumRole',
      [context.getHandler(), context.getClass()],
    );

    if (!minimumRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = user.sub;

    try {
      const userRole = await this.roleService.getUserRole(userId);

      if (!userRole) {
        throw new ForbiddenException('User has no assigned role');
      }

      const userRoleLevel = this.getRoleLevel(userRole.role);
      const minimumRoleLevel = this.getRoleLevel(minimumRole);

      if (userRoleLevel < minimumRoleLevel) {
        this.logger.warn(
          `User ${userId} with role ${userRole.role} (level ${userRoleLevel}) attempted to access endpoint requiring minimum role ${minimumRole} (level ${minimumRoleLevel})`,
        );
        throw new ForbiddenException('Insufficient role level');
      }

      return true;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error('Error during minimum role check:', error);
      throw new ForbiddenException('Authorization check failed');
    }
  }

  private getRoleLevel(role: UserRole): number {
    switch (role) {
      case UserRole.USER:
        return 1;
      case UserRole.ADMIN:
        return 2;
      case UserRole.SUPERADMIN:
        return 3;
      default:
        return 0;
    }
  }
}
