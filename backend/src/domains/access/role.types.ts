/**
 * Role and permission types for access control.
 * owner = all; accountant = ledger+invoices+reports (no tier change); viewer = read-only; sales = sales-only (errand boy)
 */
export type Role = 'owner' | 'accountant' | 'viewer' | 'sales';

export type Permission =
  | 'ledger:read'
  | 'ledger:write'
  | 'ledger:delete'
  | 'invoices:read'
  | 'invoices:write'
  | 'reports:read'
  | 'reports:write'
  | 'receipts:read'
  | 'receipts:write'
  | 'ai:read'
  | 'tax:read'
  | 'features:read'
  | 'api_keys:read'
  | 'api_keys:write'
  | 'webhooks:read'
  | 'webhooks:write'
  | 'business:tier'
  | 'business:settings'
  | 'members:manage'
  | 'invitations:manage'
  | 'compliance:export'
  | 'compliance:erasure';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    'ledger:read',
    'ledger:write',
    'ledger:delete',
    'invoices:read',
    'invoices:write',
    'reports:read',
    'reports:write',
    'receipts:read',
    'receipts:write',
    'ai:read',
    'tax:read',
    'features:read',
    'api_keys:read',
    'api_keys:write',
    'webhooks:read',
    'webhooks:write',
    'business:tier',
    'business:settings',
    'members:manage',
    'invitations:manage',
    'compliance:export',
    'compliance:erasure',
  ],
  accountant: [
    'ledger:read',
    'ledger:write',
    'invoices:read',
    'invoices:write',
    'reports:read',
    'reports:write',
    'receipts:read',
    'receipts:write',
    'ai:read',
    'tax:read',
    'features:read',
    'api_keys:read',
    'webhooks:read',
    'webhooks:write',
    'compliance:export',
  ],
  viewer: [
    'ledger:read',
    'invoices:read',
    'reports:read',
    'receipts:read',
    'ai:read',
    'tax:read',
    'features:read',
  ],
  sales: [
    'ledger:read',
    'ledger:write',
    'invoices:read',
    'invoices:write',
    'receipts:read',
    'receipts:write',
    'features:read',
  ],
};

export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}
