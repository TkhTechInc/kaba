/**
 * Role and permission types - aligned with backend role.types.ts
 *
 * owner     – full access including team management, plan changes, data erasure
 * manager   – trusted cross-branch assistant; all operational access + audit logs, no admin rights
 * accountant – ledger, invoices, reports; no team management
 * viewer    – read-only
 * sales     – invoicing/inventory only
 */
export type Role = "owner" | "manager" | "accountant" | "viewer" | "sales";

export type Permission =
  | "ledger:read"
  | "ledger:write"
  | "ledger:delete"
  | "inventory:read"
  | "inventory:write"
  | "invoices:read"
  | "invoices:write"
  | "reports:read"
  | "reports:write"
  | "receipts:read"
  | "receipts:write"
  | "ai:read"
  | "lending:read"
  | "tax:read"
  | "features:read"
  | "api_keys:read"
  | "api_keys:write"
  | "webhooks:read"
  | "webhooks:write"
  | "business:tier"
  | "business:settings"
  | "members:manage"
  | "invitations:manage"
  | "compliance:export"
  | "compliance:erasure"
  | "audit:read";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    "ledger:read",
    "ledger:write",
    "ledger:delete",
    "inventory:read",
    "inventory:write",
    "invoices:read",
    "invoices:write",
    "reports:read",
    "reports:write",
    "receipts:read",
    "receipts:write",
    "ai:read",
    "lending:read",
    "tax:read",
    "features:read",
    "api_keys:read",
    "api_keys:write",
    "webhooks:read",
    "webhooks:write",
    "business:tier",
    "business:settings",
    "members:manage",
    "invitations:manage",
    "compliance:export",
    "compliance:erasure",
    "audit:read",
  ],
  manager: [
    "ledger:read",
    "ledger:write",
    "inventory:read",
    "inventory:write",
    "invoices:read",
    "invoices:write",
    "reports:read",
    "reports:write",
    "receipts:read",
    "receipts:write",
    "ai:read",
    "lending:read",
    "tax:read",
    "features:read",
    "api_keys:read",
    "webhooks:read",
    "webhooks:write",
    "compliance:export",
    "audit:read",
  ],
  accountant: [
    "ledger:read",
    "ledger:write",
    "inventory:read",
    "inventory:write",
    "invoices:read",
    "invoices:write",
    "reports:read",
    "reports:write",
    "receipts:read",
    "receipts:write",
    "ai:read",
    "lending:read",
    "tax:read",
    "features:read",
    "api_keys:read",
    "webhooks:read",
    "webhooks:write",
    "compliance:export",
  ],
  viewer: [
    "ledger:read",
    "inventory:read",
    "invoices:read",
    "reports:read",
    "receipts:read",
    "ai:read",
    "lending:read",
    "tax:read",
    "features:read",
  ],
  sales: [
    "ledger:read",
    "ledger:write",
    "inventory:read",
    "inventory:write",
    "invoices:read",
    "invoices:write",
    "receipts:read",
    "receipts:write",
    "features:read",
  ],
};

export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  const perms = getPermissionsForRole(role);
  if (perms.includes(permission)) return true;
  if (role === "owner") return true;
  return false;
}

/** Feature key to permission mapping for read/write */
export const FEATURE_PERMISSIONS = {
  ledger: { read: "ledger:read" as Permission, write: "ledger:write" as Permission },
  inventory: { read: "inventory:read" as Permission, write: "inventory:write" as Permission },
  invoices: { read: "invoices:read" as Permission, write: "invoices:write" as Permission },
  reports: { read: "reports:read" as Permission, write: "reports:write" as Permission },
  receipts: { read: "receipts:read" as Permission, write: "receipts:write" as Permission },
  ai_query: { read: "ai:read" as Permission, write: "ai:read" as Permission },
  tax: { read: "tax:read" as Permission, write: "tax:read" as Permission },
} as const;
