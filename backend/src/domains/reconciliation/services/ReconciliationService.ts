import { Injectable, Inject, Optional } from '@nestjs/common';
import { MOBILE_MONEY_PARSER } from '../reconciliation.tokens';
import type { IMobileMoneyParser } from '../interfaces/IMobileMoneyParser';
import { LedgerService } from '@/domains/ledger/services/LedgerService';
import { LedgerEntry } from '@/domains/ledger/models/LedgerEntry';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { FeatureService } from '@/domains/features/FeatureService';
import { UsageRepository } from '@/domains/usage/UsageRepository';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import type { Invoice } from '@/domains/invoicing/models/Invoice';
import { ValidationError } from '@/shared/errors/DomainError';
import { IAuditLogger } from '@/domains/audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '@/domains/audit/AuditModule';

const AMOUNT_TOLERANCE = 1;
const DATE_TOLERANCE_DAYS = 3;

export interface MatchedInvoiceInfo {
  id: string;
  number: string;
}

export interface MobileMoneyReconResult {
  entry: LedgerEntry;
  parsed: {
    amount: number;
    currency: string;
    date: string;
    type: 'credit' | 'debit';
    reference?: string;
    description?: string;
  };
  /** Set when exactly one invoice matched and was auto-marked paid */
  matchedInvoice?: MatchedInvoiceInfo;
  /** Set when 2+ invoices match; user must choose (no auto-apply) */
  matchedInvoices?: MatchedInvoiceInfo[];
}

@Injectable()
export class ReconciliationService {
  constructor(
    @Inject(MOBILE_MONEY_PARSER) private readonly parser: IMobileMoneyParser,
    private readonly ledgerService: LedgerService,
    private readonly businessRepo: BusinessRepository,
    private readonly featureService: FeatureService,
    private readonly usageRepo: UsageRepository,
    private readonly invoiceService: InvoiceService,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
  ) {}

  async reconcileFromSms(
    businessId: string,
    smsText: string,
    userId?: string,
  ): Promise<MobileMoneyReconResult> {
    const business = await this.businessRepo.getOrCreate(businessId, 'free');
    if (!this.featureService.isEnabled('mobile_money_recon', business.tier)) {
      throw new ValidationError('Mobile money reconciliation is not available for your plan');
    }

    const count = await this.usageRepo.getMobileMoneyReconCount(businessId);
    if (!this.featureService.isWithinLimit('mobile_money_recon', business.tier, count)) {
      const limit = this.featureService.getLimit('mobile_money_recon', business.tier);
      throw new ValidationError(
        `Mobile money reconciliation limit reached (${count}/${limit} this month). Upgrade for more.`,
      );
    }

    const parsed = await this.parser.parse(smsText);

    let matchedInvoice: MatchedInvoiceInfo | undefined;
    let matchedInvoices: MatchedInvoiceInfo[] | undefined;

    if (parsed.type === 'credit') {
      try {
        const candidates = await this.findMatchingInvoices(businessId, parsed);
        if (candidates.length === 1) {
          const inv = candidates[0];
          const updated = await this.invoiceService.markPaidFromWebhook(businessId, inv.id);
          if (updated) {
            matchedInvoice = { id: inv.id, number: inv.id.slice(0, 8) };
          }
        } else if (candidates.length >= 2) {
          matchedInvoices = candidates.map((inv) => ({ id: inv.id, number: inv.id.slice(0, 8) }));
        }
      } catch (matchErr) {
        // Invoice matching is best-effort; do not abort ledger entry creation
        console.error('[ReconciliationService] Invoice matching failed:', matchErr);
      }
    }

    const type = parsed.type === 'credit' ? 'sale' : 'expense';
    const description = parsed.description
      ? parsed.description
      : parsed.reference
        ? `Mobile money: ${parsed.reference}`
        : 'Mobile money transaction';

    const entry = await this.ledgerService.createEntry(
      {
        businessId,
        type,
        amount: parsed.amount,
        currency: parsed.currency,
        date: parsed.date,
        description: description.trim(),
        category: 'Mobile Money',
      },
      userId,
    );

    await this.usageRepo.incrementMobileMoneyRecon(businessId);

    if (this.auditLogger && userId) {
      try {
        await this.auditLogger.log({
          entityType: 'Reconciliation',
          entityId: entry.id,
          businessId,
          action: 'create',
          userId,
          metadata: {
            source: 'mobile_money',
            amount: parsed.amount,
            currency: parsed.currency,
            type: parsed.type,
          },
        });
      } catch (auditErr) {
        console.error('[ReconciliationService] Audit log failed:', auditErr);
      }
    }

    const result: MobileMoneyReconResult = { entry, parsed };
    if (matchedInvoice) result.matchedInvoice = matchedInvoice;
    if (matchedInvoices) result.matchedInvoices = matchedInvoices;
    return result;
  }

  private async findMatchingInvoices(
    businessId: string,
    parsed: { amount: number; currency: string; date: string },
  ): Promise<Invoice[]> {
    const unpaid = await this.invoiceService.listUnpaid(businessId);
    const byCurrency = unpaid.filter((inv) => inv.currency === parsed.currency);
    const parsedDate = new Date(parsed.date);
    const minDate = new Date(parsedDate);
    minDate.setDate(minDate.getDate() - DATE_TOLERANCE_DAYS);
    const maxDate = new Date(parsedDate);
    maxDate.setDate(maxDate.getDate() + DATE_TOLERANCE_DAYS);

    return byCurrency.filter((inv) => {
      const amountMatch = Math.abs(inv.amount - parsed.amount) <= AMOUNT_TOLERANCE;
      // Compare against createdAt (when the invoice was issued), not dueDate.
      // Customers typically pay around invoice creation, not necessarily the due date.
      const invDate = new Date(inv.createdAt);
      const dateMatch = invDate >= minDate && invDate <= maxDate;
      return amountMatch && dateMatch;
    });
  }
}
