export type AuditAction =
  // Generic CRUD
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  // Auth lifecycle
  | 'register'
  | 'login'
  | 'login.failed'
  | 'logout'
  | 'password.reset'
  | 'token.refresh'
  // Webhook / API key lifecycle (dot-namespaced for consistency)
  | 'webhook.register'
  | 'webhook.unregister'
  | 'apikey.create'
  | 'apikey.revoke'
  // Payment lifecycle
  | 'payment.initiated'
  | 'payment.confirmed'
  | 'payment.failed'
  | 'payment.refunded'
  // Access / team lifecycle
  | 'access.invite'
  | 'access.accept'
  | 'access.revoke'
  // Compliance
  | 'compliance.export'
  | 'compliance.erasure';

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  businessId: string;
  action: AuditAction;
  userId: string;
  timestamp: string;
  changes?: Record<string, { from?: unknown; to?: unknown }>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface LogAuditInput {
  entityType: string;
  entityId: string;
  businessId: string;
  action: AuditAction;
  userId: string;
  changes?: Record<string, { from?: unknown; to?: unknown }>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
