import { IAuditLogger } from '../interfaces/IAuditLogger';
import { AuditRepository } from '../repositories/AuditRepository';
import type { AuditLog, LogAuditInput } from '../models/AuditLog';

export class AuditService implements IAuditLogger {
  constructor(private readonly auditRepository: AuditRepository) {}

  async log(input: LogAuditInput): Promise<void> {
    if (!this.auditRepository) {
      console.warn('[AuditService] auditRepository not initialized, skipping audit log');
      return;
    }
    await this.auditRepository.append(input);
  }

  async queryByBusiness(
    businessId: string,
    from?: string,
    to?: string,
    limit: number = 50,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<{ items: AuditLog[]; lastEvaluatedKey?: Record<string, unknown> }> {
    return this.auditRepository.queryByBusiness(
      businessId,
      from,
      to,
      limit,
      exclusiveStartKey
    );
  }
}
