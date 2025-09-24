import { SetMetadata } from '@nestjs/common';

import { UserRole, Permission } from '../domain/role.entity';

export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';
export const MINIMUM_ROLE_KEY = 'minimumRole';

/**
 * Decorator to require specific roles for accessing a route or controller.
 * User must have one of the specified roles.
 *
 * @example
 * ```typescript
 * @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
 * @Get('/admin-only')
 * adminOnlyEndpoint() {
 *   return 'Admin access granted';
 * }
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorator to require specific permissions for accessing a route or controller.
 * User must have ALL specified permissions.
 *
 * @example
 * ```typescript
 * @Permissions(Permission.READ_USERS, Permission.UPDATE_USERS)
 * @Get('/users')
 * getUsers() {
 *   return this.userService.getUsers();
 * }
 * ```
 */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator to require a minimum role level for accessing a route or controller.
 * User must have the specified role or higher in the hierarchy.
 *
 * @example
 * ```typescript
 * @MinimumRole(UserRole.ADMIN)
 * @Get('/admin-features')
 * adminFeatures() {
 *   // Both ADMIN and SUPERADMIN can access this
 *   return 'Admin features';
 * }
 * ```
 */
export const MinimumRole = (role: UserRole) =>
  SetMetadata(MINIMUM_ROLE_KEY, role);

/**
 * Decorator for endpoints that only the resource owner or admins can access.
 * Combines user ownership check with admin privileges.
 *
 * @example
 * ```typescript
 * @OwnerOrAdmin()
 * @Get('/profile/:userId')
 * getProfile(@Param('userId') userId: string, @Request() req) {
 *   // User can access their own profile, admins can access any profile
 *   return this.userService.getProfile(userId);
 * }
 * ```
 */
export const OwnerOrAdmin = () =>
  SetMetadata(PERMISSIONS_KEY, [Permission.READ_USERS]);

/**
 * Decorator for public endpoints that don't require authentication.
 * This will bypass all role and permission checks.
 *
 * @example
 * ```typescript
 * @Public()
 * @Get('/health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const Public = () => SetMetadata('isPublic', true);

/**
 * Decorator to allow users to access their own resources.
 * Must be used with appropriate guards that check user ownership.
 *
 * @example
 * ```typescript
 * @AllowSelf()
 * @Get('/profile')
 * getOwnProfile(@Request() req) {
 *   return this.userService.getProfile(req.user.sub);
 * }
 * ```
 */
export const AllowSelf = () => SetMetadata('allowSelf', true);

/**
 * Combined decorator for common admin-only operations.
 */
export const AdminOnly = () => Roles(UserRole.ADMIN, UserRole.SUPERADMIN);

/**
 * Combined decorator for super admin only operations.
 */
export const SuperAdminOnly = () => Roles(UserRole.SUPERADMIN);

/**
 * Combined decorator for user management permissions.
 */
export const UserManagement = () =>
  Permissions(Permission.READ_USERS, Permission.UPDATE_USERS);

/**
 * Combined decorator for billing management permissions.
 */
export const BillingManagement = () => Permissions(Permission.MANAGE_BILLING);

/**
 * Combined decorator for deployment management permissions.
 */
export const DeploymentManagement = () =>
  Permissions(Permission.MANAGE_DEPLOYMENTS);

/**
 * Combined decorator for system administration permissions.
 */
export const SystemAdmin = () => Permissions(Permission.SYSTEM_ADMIN);

/**
 * Utility type for extracting role metadata from decorators.
 */
export type RoleMetadata = {
  roles?: UserRole[];
  permissions?: Permission[];
  minimumRole?: UserRole;
  isPublic?: boolean;
  allowSelf?: boolean;
};

/**
 * Helper function to combine multiple permission decorators.
 * Useful for complex authorization scenarios.
 *
 * @example
 * ```typescript
 * const CombinedPermissions = combinePermissions([
 *   Permission.READ_USERS,
 *   Permission.UPDATE_USERS,
 *   Permission.MANAGE_ROLES
 * ]);
 *
 * @CombinedPermissions
 * @Post('/assign-role')
 * assignRole() {
 *   // Requires all three permissions
 * }
 * ```
 */
export const combinePermissions = (permissions: Permission[]) =>
  Permissions(...permissions);

/**
 * Helper function to create role-based decorators dynamically.
 *
 * @example
 * ```typescript
 * const ManagerOrHigher = createRoleDecorator([UserRole.ADMIN, UserRole.SUPERADMIN]);
 *
 * @ManagerOrHigher()
 * @Get('/management')
 * managementEndpoint() {
 *   return 'Management access';
 * }
 * ```
 */
export const createRoleDecorator = (roles: UserRole[]) => () => Roles(...roles);
