import { Module } from '@nestjs/common';

import { RolesGuard, MinimumRoleGuard } from './guards/roles.guard';
import { RoleService } from './services/role.service';

@Module({
  providers: [RoleService, RolesGuard, MinimumRoleGuard],
  exports: [RoleService, RolesGuard, MinimumRoleGuard],
})
export class RolesModule {}
