export type AuditAction = 'create' | 'update' | 'delete' | 'register' | 'unregister' | 'revoke';

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
