import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@/domains/access/role.types';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

/**
 * Require a specific permission for the route.
 * Use with PermissionGuard. Extracts businessId from request body/query.
 */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
