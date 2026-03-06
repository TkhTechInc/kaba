import type { LogAuditInput } from '../models/AuditLog';

export const AUDIT_LOGGER = 'IAuditLogger';

export interface IAuditLogger {
  log(input: LogAuditInput): Promise<void>;
}
