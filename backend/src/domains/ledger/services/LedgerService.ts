import { Injectable, Inject, Optional } from '@nestjs/common';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { LedgerRepository, ListByBusinessResult } from '../repositories/LedgerRepository';
import { LedgerEntry, CreateLedgerEntryInput } from '../models/LedgerEntry';
import { ValidationError, NotFoundError } from '@/shared/errors/DomainError';
import { SmsService } from '@/domains/notifications/SmsService';
import { FeatureService } from '@/domains/features/FeatureService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { WebhookService } from '@/domains/webhooks/WebhookService';
import { IAuditLogger } from '../../audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '../../audit/AuditModule';
import { ProductRepository } from '@/domains/inventory/repositories/ProductRepository';
import type { ICategorySuggester } from '../interfaces/ICategorySuggester';

export const EVENT_BRIDGE_CLIENT = 'EVENT_BRIDGE_CLIENT';
export const CATEGORY_SUGGESTER = 'CATEGORY_SUGGESTER';

export interface BalanceResult {
  businessId: string;
  balance: number;
  currency: string;
}

function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const to = lastDay.toISOString().split('T')[0];
  return { from, to };
}

@Injectable()
export class LedgerService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly productRepository: ProductRepository,
    private readonly smsService: SmsService,
    private readonly featureService: FeatureService,
    private readonly businessRepo: BusinessRepository,
    private readonly webhookService: WebhookService,
    @Inject(EVENT_BRIDGE_CLIENT) private readonly eventBridge: EventBridgeClient,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
    @Optional() @Inject(CATEGORY_SUGGESTER) private readonly categorySuggester?: ICategorySuggester,
  ) {}

  async createEntry(
    input: CreateLedgerEntryInput,
    userId?: string,
    auditContext?: { ipAddress?: string; userAgent?: string },
  ): Promise<LedgerEntry> {
    if (!input.businessId?.trim()) {
      throw new ValidationError('businessId is required');
    }
    if (!['sale', 'expense'].includes(input.type)) {
      throw new ValidationError('type must be "sale" or "expense"');
    }
    if (!input.currency?.trim()) {
      throw new ValidationError('currency is required');
    }
    if (!input.date?.trim()) {
      throw new ValidationError('date is required');
    }

    let amount = input.amount;
    let description = input.description ?? '';
    let productId: string | undefined;
    let quantitySold: number | undefined;
    let updatedProduct: import('@/domains/inventory/models/Product').Product | null = null;

    if (input.productId && input.quantitySold != null) {
      if (input.type !== 'sale') {
        throw new ValidationError('productId and quantitySold are only valid for type "sale"');
      }
      const product = await this.productRepository.getById(input.businessId, input.productId);
      if (!product) {
        throw new NotFoundError('Product', input.productId);
      }
      if (input.quantitySold > product.quantityInStock) {
        throw new ValidationError(
          `Insufficient stock. Available: ${product.quantityInStock}, requested: ${input.quantitySold}`,
        );
      }
      updatedProduct = await this.productRepository.decrementStock(
        input.businessId,
        input.productId,
        input.quantitySold,
      );
      if (!updatedProduct) {
        throw new ValidationError('Failed to decrement stock (concurrent update or insufficient stock)');
      }
      amount = product.unitPrice * input.quantitySold;
      description = `${product.name} x ${input.quantitySold}`;
      productId = input.productId;
      quantitySold = input.quantitySold;

      if (
        updatedProduct.lowStockThreshold != null &&
        updatedProduct.quantityInStock <= updatedProduct.lowStockThreshold
      ) {
        this.webhookService.emit(input.businessId, 'inventory.low_stock', {
          productId: updatedProduct.id,
          productName: updatedProduct.name,
          quantityInStock: updatedProduct.quantityInStock,
          lowStockThreshold: updatedProduct.lowStockThreshold,
        });
      }
    } else {
      if (typeof input.amount !== 'number' || isNaN(input.amount)) {
        throw new ValidationError('amount is required when not using productId');
      }
      amount = input.amount;
      description = input.description ?? '';
    }

    const business = await this.businessRepo.getOrCreate(input.businessId, 'free');
    if (!input.skipLimitCheck) {
      const { from, to } = getCurrentMonthRange();
      const count = await this.ledgerRepository.countByBusinessInDateRange(
        input.businessId,
        from,
        to,
      );
      if (!this.featureService.isWithinLimit('ledger', business.tier, count)) {
        const limit = this.featureService.getLimit('ledger', business.tier);
        throw new ValidationError(
          `Ledger entry limit reached (${count}/${limit} this month). Upgrade your plan for more.`,
        );
      }
    }

    const { skipLimitCheck: _, ...createInput } = input;
    const entry = await this.ledgerRepository.create({
      ...createInput,
      amount,
      description,
      productId,
      quantitySold,
    });

    this.webhookService.emit(input.businessId, 'ledger.entry.created', {
      entryId: entry.id,
      type: entry.type,
      amount: entry.amount,
      currency: entry.currency,
      date: entry.date,
    });

    const eventPayload = {
      businessId: entry.businessId,
      entryId: entry.id,
      type: entry.type,
      amount: entry.amount,
      currency: entry.currency,
      date: entry.date,
    };
    try {
      await this.eventBridge.send(
        new PutEventsCommand({
          Entries: [
            {
              Source: 'kaba.ledger',
              DetailType: 'LedgerEntryCreated',
              Detail: JSON.stringify(eventPayload),
            },
          ],
        })
      );
    } catch (eventErr) {
      console.error('[LedgerService] EventBridge PutEvents failed:', eventErr);
    }

    if (this.auditLogger && userId) {
      try {
        await this.auditLogger.log({
          entityType: 'LedgerEntry',
          entityId: entry.id,
          businessId: entry.businessId,
          action: 'create',
          userId,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent,
        });
      } catch (auditErr) {
        console.error('[LedgerService] Audit log failed:', auditErr);
      }
    }

    if (
      input.smsPhone?.trim() &&
      this.featureService.isEnabled('sms_receipts', business.tier)
    ) {
      const message = this.smsService.formatReceiptMessage(
        input.type,
        amount,
        input.currency,
        description,
      );
      await this.smsService.sendTransactionReceipt(input.smsPhone.trim(), message);
    }

    if (
      updatedProduct &&
      business.phone?.trim() &&
      this.featureService.isEnabled('sms_receipts', business.tier) &&
      updatedProduct.lowStockThreshold != null &&
      updatedProduct.quantityInStock <= updatedProduct.lowStockThreshold
    ) {
      const lowStockMsg = `Kaba: Low stock alert - ${updatedProduct.name} has ${updatedProduct.quantityInStock} left (threshold: ${updatedProduct.lowStockThreshold}). Restock soon.`;
      await this.smsService.send(business.phone.trim(), lowStockMsg);
    }

    return entry;
  }

  async listEntries(
    businessId: string,
    page: number = 1,
    limit: number = 20,
    exclusiveStartKey?: Record<string, unknown>,
    type?: 'sale' | 'expense',
    fromDate?: string,
    toDate?: string,
  ): Promise<ListByBusinessResult> {
    if (!businessId?.trim()) {
      throw new ValidationError('businessId is required');
    }

    return this.ledgerRepository.listByBusiness(businessId, page, limit, exclusiveStartKey, type, fromDate, toDate);
  }

  async countEntries(businessId: string): Promise<number> {
    if (!businessId?.trim()) return 0;
    return this.ledgerRepository.countByBusiness(businessId);
  }

  async getBalance(businessId: string): Promise<BalanceResult> {
    if (!businessId?.trim()) {
      throw new ValidationError('businessId is required');
    }

    const business = await this.businessRepo.getOrCreate(businessId, 'free');
    const defaultCurrency = business.currency ?? 'NGN';

    // O(1) fast path: a dedicated BALANCE item is kept in sync atomically on every
    // entry create/delete via UpdateItem ADD. This avoids scanning all ledger entries.
    const running = await this.ledgerRepository.getRunningBalance(businessId);
    if (running !== null) {
      return {
        businessId,
        balance: running.balance,
        currency: running.currency,
      };
    }

    // Fallback: counter not yet initialised (no entries exist).
    // Uses ProjectionExpression to fetch only `type` and `amount`, reducing data transfer.
    const entries = await this.ledgerRepository.listAllByBusinessForBalance(businessId);

    let balance = 0;
    let currency = defaultCurrency;

    for (const entry of entries) {
      if (entry.type === 'sale') {
        balance += entry.amount;
      } else if (entry.type === 'expense') {
        balance -= entry.amount;
      }
    }

    return {
      businessId,
      balance,
      currency,
    };
  }

  async softDeleteEntry(
    businessId: string,
    id: string,
    userId?: string,
    auditContext?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    if (!businessId?.trim()) {
      throw new ValidationError('businessId is required');
    }
    if (!id?.trim()) {
      throw new ValidationError('id is required');
    }

    const entry = await this.ledgerRepository.getById(businessId, id);
    if (!entry) {
      throw new NotFoundError('LedgerEntry', id);
    }
    if (entry.deletedAt) {
      throw new ValidationError('Ledger entry already deleted');
    }

    // OHADA Ledger Lock: reject deletion of entries in a closed period
    const entryPeriod = entry.date.slice(0, 7); // "YYYY-MM"
    const lockedPeriods = await this.businessRepo.getLockedPeriods(businessId);
    if (lockedPeriods.includes(entryPeriod)) {
      throw new ValidationError(
        `Cannot delete entries in a locked period (${entryPeriod}). Create a reversal entry instead.`
      );
    }

    await this.ledgerRepository.softDelete(businessId, id);

    this.webhookService.emit(businessId, 'ledger.entry.deleted', {
      entryId: id,
      type: entry.type,
      amount: entry.amount,
      currency: entry.currency,
      date: entry.date,
    });

    if (this.auditLogger && userId) {
      try {
        await this.auditLogger.log({
          entityType: 'LedgerEntry',
          entityId: id,
          businessId,
          action: 'delete',
          userId,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent,
        });
      } catch (auditErr) {
        console.error('[LedgerService] Audit log failed:', auditErr);
      }
    }
  }

  async listWithCursor(
    businessId: string,
    limit: number = 20,
    cursor?: string,
    type?: 'sale' | 'expense',
    fromDate?: string,
    toDate?: string,
  ) {
    return this.ledgerRepository.listWithCursor(businessId, limit, cursor, type, fromDate, toDate);
  }
}
