/**
 * Role and permission types for access control.
 *
 * owner     – full access, including team management, plan changes, and data erasure
 * manager   – cross-branch trusted assistant; all operational access + audit logs, no admin/team rights
 * accountant – ledger, invoices, reports; no team management or audit logs
 * viewer    – read-only across all operational data
 * sales     – create/manage invoices and inventory; no reports or settings
 */
export type Role = 'owner' | 'manager' | 'accountant' | 'viewer' | 'sales';

export type Permission =
  | 'ledger:read'
  | 'ledger:write'
  | 'ledger:delete'
  | 'inventory:read'
  | 'inventory:write'
  | 'invoices:read'
  | 'invoices:write'
  | 'reports:read'
  | 'reports:write'
  | 'receipts:read'
  | 'receipts:write'
  | 'ai:read'
  | 'lending:read'
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
  | 'compliance:erasure'
  | 'audit:read';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    'ledger:read',
    'ledger:write',
    'ledger:delete',
    'inventory:read',
    'inventory:write',
    'invoices:read',
    'invoices:write',
    'reports:read',
    'reports:write',
    'receipts:read',
    'receipts:write',
    'ai:read',
    'lending:read',
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
    'audit:read',
  ],
  /**
   * Manager: trusted cross-branch assistant.
   * Gets all operational permissions + audit logs and compliance export.
   * Cannot manage team members, change plan/settings, delete records, or erase data.
   */
  manager: [
    'ledger:read',
    'ledger:write',
    'inventory:read',
    'inventory:write',
    'invoices:read',
    'invoices:write',
    'reports:read',
    'reports:write',
    'receipts:read',
    'receipts:write',
    'ai:read',
    'lending:read',
    'tax:read',
    'features:read',
    'api_keys:read',
    'webhooks:read',
    'webhooks:write',
    'compliance:export',
    'audit:read',
  ],
  accountant: [
    'ledger:read',
    'ledger:write',
    'inventory:read',
    'inventory:write',
    'invoices:read',
    'invoices:write',
    'reports:read',
    'reports:write',
    'receipts:read',
    'receipts:write',
    'ai:read',
    'lending:read',
    'tax:read',
    'features:read',
    'api_keys:read',
    'webhooks:read',
    'webhooks:write',
    'compliance:export',
  ],
  viewer: [
    'ledger:read',
    'inventory:read',
    'invoices:read',
    'reports:read',
    'receipts:read',
    'ai:read',
    'lending:read',
    'tax:read',
    'features:read',
  ],
  sales: [
    'ledger:read',
    'ledger:write',
    'inventory:read',
    'inventory:write',
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
