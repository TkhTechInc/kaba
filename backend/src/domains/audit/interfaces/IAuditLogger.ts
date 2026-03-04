import type { LogAuditInput } from '../models/AuditLog';

export interface IAuditLogger {
  log(input: LogAuditInput): Promise<void>;
}
