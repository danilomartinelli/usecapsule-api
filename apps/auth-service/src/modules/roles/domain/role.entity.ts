export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPERADMIN = 'SUPERADMIN',
}

export enum Permission {
  READ_OWN_PROFILE = 'READ_OWN_PROFILE',
  UPDATE_OWN_PROFILE = 'UPDATE_OWN_PROFILE',
  DELETE_OWN_PROFILE = 'DELETE_OWN_PROFILE',

  READ_USERS = 'READ_USERS',
  CREATE_USERS = 'CREATE_USERS',
  UPDATE_USERS = 'UPDATE_USERS',
  DELETE_USERS = 'DELETE_USERS',

  MANAGE_ROLES = 'MANAGE_ROLES',
  MANAGE_PERMISSIONS = 'MANAGE_PERMISSIONS',

  READ_BILLING = 'READ_BILLING',
  MANAGE_BILLING = 'MANAGE_BILLING',

  READ_DEPLOYMENTS = 'READ_DEPLOYMENTS',
  CREATE_DEPLOYMENTS = 'CREATE_DEPLOYMENTS',
  MANAGE_DEPLOYMENTS = 'MANAGE_DEPLOYMENTS',
  DELETE_DEPLOYMENTS = 'DELETE_DEPLOYMENTS',

  READ_MONITORING = 'READ_MONITORING',
  MANAGE_MONITORING = 'MANAGE_MONITORING',

  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

export interface RolePermissions {
  [UserRole.USER]: Permission[];
  [UserRole.ADMIN]: Permission[];
  [UserRole.SUPERADMIN]: Permission[];
}

const USER_PERMISSIONS: Permission[] = [
  Permission.READ_OWN_PROFILE,
  Permission.UPDATE_OWN_PROFILE,
  Permission.DELETE_OWN_PROFILE,
  Permission.READ_BILLING,
  Permission.READ_DEPLOYMENTS,
  Permission.CREATE_DEPLOYMENTS,
  Permission.READ_MONITORING,
];

const ADMIN_PERMISSIONS: Permission[] = [
  // All USER permissions
  ...USER_PERMISSIONS,
  // Additional ADMIN permissions
  Permission.READ_USERS,
  Permission.CREATE_USERS,
  Permission.UPDATE_USERS,
  Permission.MANAGE_BILLING,
  Permission.MANAGE_DEPLOYMENTS,
  Permission.DELETE_DEPLOYMENTS,
  Permission.MANAGE_MONITORING,
];

const SUPERADMIN_PERMISSIONS: Permission[] = [
  // All ADMIN permissions
  ...ADMIN_PERMISSIONS,
  // Additional SUPERADMIN permissions
  Permission.DELETE_USERS,
  Permission.MANAGE_ROLES,
  Permission.MANAGE_PERMISSIONS,
  Permission.SYSTEM_ADMIN,
];

export const ROLE_PERMISSIONS: RolePermissions = {
  [UserRole.USER]: USER_PERMISSIONS,
  [UserRole.ADMIN]: ADMIN_PERMISSIONS,
  [UserRole.SUPERADMIN]: SUPERADMIN_PERMISSIONS,
};

export class RoleAssignment {
  public readonly id: string;
  public readonly userId: string;
  public readonly role: UserRole;
  public readonly assignedBy: string;
  public readonly assignedAt: Date;
  public readonly expiresAt?: Date;
  public readonly isActive: boolean;
  public readonly metadata?: Record<string, unknown>;

  constructor(data: {
    id: string;
    userId: string;
    role: UserRole;
    assignedBy: string;
    assignedAt: Date;
    expiresAt?: Date;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  }) {
    this.id = data.id;
    this.userId = data.userId;
    this.role = data.role;
    this.assignedBy = data.assignedBy;
    this.assignedAt = data.assignedAt;
    this.expiresAt = data.expiresAt;
    this.isActive = data.isActive ?? true;
    this.metadata = data.metadata;
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  isValidAssignment(): boolean {
    return this.isActive && !this.isExpired();
  }

  hasPermission(permission: Permission): boolean {
    if (!this.isValidAssignment()) return false;
    return ROLE_PERMISSIONS[this.role].includes(permission);
  }

  getPermissions(): Permission[] {
    if (!this.isValidAssignment()) return [];
    return ROLE_PERMISSIONS[this.role];
  }

  static getRoleHierarchyLevel(role: UserRole): number {
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

  canAssignRole(targetRole: UserRole): boolean {
    if (!this.isValidAssignment()) return false;

    const currentLevel = RoleAssignment.getRoleHierarchyLevel(this.role);
    const targetLevel = RoleAssignment.getRoleHierarchyLevel(targetRole);

    return currentLevel > targetLevel;
  }

  extend(newExpirationDate?: Date): RoleAssignment {
    return new RoleAssignment({
      ...this,
      expiresAt: newExpirationDate,
    });
  }

  revoke(): RoleAssignment {
    return new RoleAssignment({
      ...this,
      isActive: false,
    });
  }
}
