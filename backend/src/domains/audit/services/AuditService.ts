import { IAuditLogger } from '../interfaces/IAuditLogger';
import { AuditRepository } from '../repositories/AuditRepository';
import type { AuditLog, LogAuditInput } from '../models/AuditLog';

export class AuditService implements IAuditLogger {
  constructor(private readonly auditRepository: AuditRepository) {}

  async log(input: LogAuditInput): Promise<void> {
    await this.auditRepository.append(input);
  }

  async queryByBusiness(
    businessId: string,
    from?: string,
    to?: string,
    limit: number = 50,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<{ items: AuditLog[]; lastEvaluatedKey?: Record<string, unknown> }> {
    return this.auditRepository.queryByBusiness(businessId, from, to, limit, exclusiveStartKey);
  }

  async queryByUserId(
    userId: string,
    businessId?: string,
    from?: string,
    to?: string,
    limit: number = 50,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<{ items: AuditLog[]; lastEvaluatedKey?: Record<string, unknown> }> {
    return this.auditRepository.queryByUserId(userId, businessId, from, to, limit, exclusiveStartKey);
  }

  async queryByEntityId(
    entityId: string,
    businessId?: string,
    from?: string,
    to?: string,
    limit: number = 50,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<{ items: AuditLog[]; lastEvaluatedKey?: Record<string, unknown> }> {
    return this.auditRepository.queryByEntityId(entityId, businessId, from, to, limit, exclusiveStartKey);
  }
}
