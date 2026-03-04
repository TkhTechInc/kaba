import { ConfigService } from '@nestjs/config';
import { Inject, Optional } from '@nestjs/common';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { InvoiceRepository } from '@/domains/invoicing/repositories/InvoiceRepository';
import { CustomerRepository } from '@/domains/invoicing/repositories/CustomerRepository';
import { AuditRepository } from '@/domains/audit/repositories/AuditRepository';
import { IAuditLogger } from '@/domains/audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '@/domains/audit/AuditModule';
import { getComplianceForRegion } from '@/shared/compliance/RegionalCompliance';

/**
 * ComplianceService - Data protection compliance (NDPR, Ghana DPA, ECOWAS).
 *
 * Retention: Audit logs use TTL for automatic deletion. Configure via:
 * - compliance.auditRetentionDays (default 365)
 * - AUDIT_RETENTION_DAYS env var
 *
 * Grace period: After erasure, soft-deleted data can be hard-deleted after:
 * - compliance.erasureGracePeriodDays (default 30)
 * - ERASURE_GRACE_PERIOD_DAYS env var
 */
export interface BusinessDataExport {
  exportedAt: string;
  businessId: string;
  ledgerEntries: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  customers: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
}

export interface ErasureResult {
  businessId: string;
  erasedAt: string;
  customersAnonymized: number;
  ledgerEntriesSoftDeleted: number;
  invoicesSoftDeleted: number;
  gracePeriodDays: number;
}

export class ComplianceService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly auditRepository: AuditRepository,
    @Optional() @Inject(ConfigService) private readonly configService: ConfigService | null,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
  ) {}

  getComplianceForRegion(countryCode: string) {
    return getComplianceForRegion(countryCode);
  }

  /**
   * Export all business data (right to portability).
   * Returns JSON with ledger entries, invoices, customers (PII), audit logs.
   */
  async exportBusinessData(businessId: string): Promise<BusinessDataExport> {
    const [ledgerEntries, invoices, customers, auditResult] = await Promise.all([
      this.ledgerRepository.listAllByBusiness(businessId),
      this.invoiceRepository.listAllByBusiness(businessId),
      this.customerRepository.listAllByBusiness(businessId),
      this.auditRepository.listAllByBusiness(businessId),
    ]);

    const export_ = {
      exportedAt: new Date().toISOString(),
      businessId,
      ledgerEntries: ledgerEntries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: e.amount,
        currency: e.currency,
        description: e.description,
        category: e.category,
        date: e.date,
        createdAt: e.createdAt,
        deletedAt: e.deletedAt,
      })),
      invoices: invoices.map((i) => ({
        id: i.id,
        customerId: i.customerId,
        amount: i.amount,
        currency: i.currency,
        status: i.status,
        items: i.items,
        dueDate: i.dueDate,
        createdAt: i.createdAt,
        deletedAt: i.deletedAt,
      })),
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
      })),
      auditLogs: auditResult.map((a) => ({
        id: a.id,
        entityType: a.entityType,
        entityId: a.entityId,
        action: a.action,
        userId: a.userId,
        timestamp: a.timestamp,
      })),
    };

    return export_;
  }

  /**
   * Erase business data (right to be forgotten).
   * Anonymizes customers (name/email/phone -> [erased]), soft-deletes ledger and invoices.
   * Grace period config: data can be hard-deleted after erasureGracePeriodDays.
   */
  async eraseBusinessData(businessId: string): Promise<ErasureResult> {
    const [customers, ledgerEntries, invoices] = await Promise.all([
      this.customerRepository.listAllByBusiness(businessId),
      this.ledgerRepository.listAllByBusiness(businessId),
      this.invoiceRepository.listAllByBusiness(businessId),
    ]);

    let customersAnonymized = 0;
    for (const c of customers) {
      await this.customerRepository.anonymize(businessId, c.id);
      customersAnonymized++;
    }

    let ledgerSoftDeleted = 0;
    for (const e of ledgerEntries) {
      if (!e.deletedAt) {
        await this.ledgerRepository.softDelete(businessId, e.id);
        ledgerSoftDeleted++;
      }
    }

    let invoicesSoftDeleted = 0;
    for (const i of invoices) {
      if (!i.deletedAt) {
        await this.invoiceRepository.softDelete(businessId, i.id);
        invoicesSoftDeleted++;
      }
    }

    const gracePeriodDays =
      this.configService?.get<number>('compliance.erasureGracePeriodDays') ?? parseInt(process.env['ERASURE_GRACE_PERIOD_DAYS'] || '30', 10);

    return {
      businessId,
      erasedAt: new Date().toISOString(),
      customersAnonymized,
      ledgerEntriesSoftDeleted: ledgerSoftDeleted,
      invoicesSoftDeleted,
      gracePeriodDays,
    };
  }

  /** Log compliance event to audit (export, erasure, consent). */
  async logComplianceEvent(
    businessId: string,
    userId: string,
    event: 'data.export' | 'data.erasure' | 'consent.granted' | 'consent.withdrawn',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.auditLogger) return;
    await this.auditLogger.log({
      entityType: 'Compliance',
      entityId: event,
      businessId,
      action: 'create',
      userId,
      metadata: { event, ...metadata },
    });
  }
}
