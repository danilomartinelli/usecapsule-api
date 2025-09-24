import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import type { UserRole, Permission } from '../domain/role.entity';
import { RoleAssignment, ROLE_PERMISSIONS } from '../domain/role.entity';

export interface AssignRoleDto {
  userId: string;
  role: UserRole;
  assignedBy: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface RoleAssignmentResult {
  success: boolean;
  assignment?: RoleAssignment;
  error?: string;
}

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);
  private readonly roleAssignments = new Map<string, RoleAssignment>();
  private readonly userRoles = new Map<string, RoleAssignment[]>();

  async assignRole(dto: AssignRoleDto): Promise<RoleAssignmentResult> {
    try {
      const assignerRole = await this.getUserRole(dto.assignedBy);

      if (!assignerRole) {
        return {
          success: false,
          error: 'Assigner does not have a valid role',
        };
      }

      if (!assignerRole.canAssignRole(dto.role)) {
        return {
          success: false,
          error: 'Insufficient permissions to assign this role',
        };
      }

      await this.revokeUserRole(dto.userId);

      const assignment = new RoleAssignment({
        id: uuidv4(),
        userId: dto.userId,
        role: dto.role,
        assignedBy: dto.assignedBy,
        assignedAt: new Date(),
        expiresAt: dto.expiresAt,
        isActive: true,
        metadata: dto.metadata,
      });

      this.roleAssignments.set(assignment.id, assignment);

      const userAssignments = this.userRoles.get(dto.userId) || [];
      userAssignments.push(assignment);
      this.userRoles.set(dto.userId, userAssignments);

      this.logger.log(
        `Role ${dto.role} assigned to user ${dto.userId} by ${dto.assignedBy}`,
      );

      return {
        success: true,
        assignment,
      };
    } catch (error) {
      this.logger.error('Failed to assign role:', error);
      return {
        success: false,
        error: 'Role assignment failed',
      };
    }
  }

  async revokeUserRole(userId: string): Promise<boolean> {
    try {
      const userAssignments = this.userRoles.get(userId) || [];

      for (const assignment of userAssignments) {
        if (assignment.isValidAssignment()) {
          const revokedAssignment = assignment.revoke();
          this.roleAssignments.set(assignment.id, revokedAssignment);
          this.logger.log(`Role revoked for user ${userId}`);
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to revoke role:', error);
      return false;
    }
  }

  async getUserRole(userId: string): Promise<RoleAssignment | null> {
    const userAssignments = this.userRoles.get(userId) || [];

    const activeAssignment = userAssignments.find((assignment) =>
      assignment.isValidAssignment(),
    );

    return activeAssignment || null;
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const roleAssignment = await this.getUserRole(userId);
    return roleAssignment ? roleAssignment.getPermissions() : [];
  }

  async hasPermission(
    userId: string,
    permission: Permission,
  ): Promise<boolean> {
    const roleAssignment = await this.getUserRole(userId);
    return roleAssignment ? roleAssignment.hasPermission(permission) : false;
  }

  async hasAnyPermission(
    userId: string,
    permissions: Permission[],
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.some((permission) =>
      userPermissions.includes(permission),
    );
  }

  async hasAllPermissions(
    userId: string,
    permissions: Permission[],
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }

  async extendRoleExpiration(
    userId: string,
    newExpirationDate?: Date,
  ): Promise<RoleAssignmentResult> {
    try {
      const currentAssignment = await this.getUserRole(userId);

      if (!currentAssignment) {
        return {
          success: false,
          error: 'No active role assignment found',
        };
      }

      const extendedAssignment = currentAssignment.extend(newExpirationDate);
      this.roleAssignments.set(currentAssignment.id, extendedAssignment);

      this.logger.log(`Role expiration extended for user ${userId}`);

      return {
        success: true,
        assignment: extendedAssignment,
      };
    } catch (error) {
      this.logger.error('Failed to extend role expiration:', error);
      return {
        success: false,
        error: 'Failed to extend role expiration',
      };
    }
  }

  async getUsersByRole(role: UserRole): Promise<string[]> {
    const userIds: string[] = [];

    for (const [userId, assignments] of this.userRoles.entries()) {
      const activeAssignment = assignments.find(
        (assignment) =>
          assignment.isValidAssignment() && assignment.role === role,
      );

      if (activeAssignment) {
        userIds.push(userId);
      }
    }

    return userIds;
  }

  async getRoleHierarchy(): Promise<Record<UserRole, Permission[]>> {
    return ROLE_PERMISSIONS;
  }

  async getUserRoleHistory(userId: string): Promise<RoleAssignment[]> {
    return this.userRoles.get(userId) || [];
  }

  async cleanupExpiredRoles(): Promise<number> {
    let cleanedCount = 0;

    for (const [_userId, assignments] of this.userRoles.entries()) {
      for (const assignment of assignments) {
        if (assignment.isExpired() && assignment.isActive) {
          const expiredAssignment = assignment.revoke();
          this.roleAssignments.set(assignment.id, expiredAssignment);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired role assignments`);
    }

    return cleanedCount;
  }

  async validateRoleAssignmentPermissions(
    assignerId: string,
    targetRole: UserRole,
  ): Promise<boolean> {
    const assignerRole = await this.getUserRole(assignerId);

    if (!assignerRole) {
      return false;
    }

    return assignerRole.canAssignRole(targetRole);
  }
}
