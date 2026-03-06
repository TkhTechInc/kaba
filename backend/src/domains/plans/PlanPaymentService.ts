import { Injectable, Inject, Optional } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PlanPaymentRepository } from './PlanPaymentRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { PaymentGatewayManager } from '@/domains/payments/gateways/PaymentGatewayManager';
import { NotFoundError, ValidationError } from '@/shared/errors/DomainError';
import type { Tier } from '@/domains/features/feature.types';
import { IAuditLogger } from '@/domains/audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '@/domains/audit/AuditModule';

const PLAN_PRICES: Record<string, Record<Tier, number | null>> = {
  NGN: { free: 0, starter: 5000, pro: 15000, enterprise: 50000 },
  GHS: { free: 0, starter: 50, pro: 150, enterprise: 500 },
  XOF: { free: 0, starter: 2500, pro: 7500, enterprise: 25000 },
  XAF: { free: 0, starter: 2500, pro: 7500, enterprise: 25000 },
  USD: { free: 0, starter: 5, pro: 15, enterprise: 50 },
  EUR: { free: 0, starter: 5, pro: 15, enterprise: 50 },
};

const TIER_ORDER: Tier[] = ['free', 'starter', 'pro', 'enterprise'];

function tierIndex(t: Tier): number {
  return TIER_ORDER.indexOf(t);
}

@Injectable()
export class PlanPaymentService {
  constructor(
    private readonly planPaymentRepo: PlanPaymentRepository,
    private readonly businessRepo: BusinessRepository,
    private readonly paymentGatewayManager: PaymentGatewayManager,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
  ) {}

  /** Create checkout session for plan upgrade. Returns token and pay URL. */
  async createCheckout(
    businessId: string,
    targetTier: Tier,
    baseUrl: string,
    userId?: string,
  ): Promise<{ token: string; payUrl: string; amount: number; currency: string; useKkiaPayWidget: boolean }> {
    const business = await this.businessRepo.getById(businessId);
    if (!business) throw new NotFoundError('Business', businessId);

    const currency = (business.currency ?? 'XOF').toUpperCase();
    const prices = PLAN_PRICES[currency] ?? PLAN_PRICES.XOF;
    const amount = prices[targetTier] ?? 0;

    if (amount <= 0) {
      throw new ValidationError(`Plan ${targetTier} is free. No payment required.`);
    }

    const currentIdx = tierIndex(business.tier ?? 'free');
    const targetIdx = tierIndex(targetTier);
    if (targetIdx <= currentIdx) {
      throw new ValidationError('Select a higher plan to upgrade.');
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await this.planPaymentRepo.create({
      token,
      businessId,
      targetTier,
      amount,
      currency,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    if (this.auditLogger && userId) {
      this.auditLogger.log({
        entityType: 'subscription',
        entityId: token,
        businessId,
        action: 'create',
        userId,
        metadata: { targetTier, amount, currency },
      }).catch(() => {});
    }

    const payUrl = `${baseUrl.replace(/\/$/, '')}/pay/plan/${token}`;

    const useKkiaPayWidget =
      this.paymentGatewayManager.isKkiaPayAvailable() &&
      ['XOF', 'XAF', 'GNF'].includes(currency);

    return { token, payUrl, amount, currency, useKkiaPayWidget };
  }

  /** Get plan payment data for pay page (public, no auth). */
  async getPayData(token: string): Promise<{
    businessName: string;
    targetTier: string;
    amount: number;
    currency: string;
    useKkiaPayWidget: boolean;
  } | null> {
    const record = await this.planPaymentRepo.getByToken(token);
    if (!record) return null;
    if (new Date(record.expiresAt) < new Date()) return null;

    const business = await this.businessRepo.getById(record.businessId);

    const useKkiaPayWidget =
      this.paymentGatewayManager.isKkiaPayAvailable() &&
      ['XOF', 'XAF', 'GNF'].includes(record.currency?.toUpperCase() ?? '');

    return {
      businessName: business?.name ?? 'Business',
      targetTier: record.targetTier,
      amount: record.amount,
      currency: record.currency,
      useKkiaPayWidget,
    };
  }

  /** Confirm KkiaPay payment and update tier. */
  async confirmKkiaPayPayment(
    token: string,
    transactionId: string,
    redirectStatus?: string,
  ): Promise<{ success: boolean; error?: string; businessId?: string }> {
    const record = await this.planPaymentRepo.getByToken(token);
    if (!record) return { success: false, error: 'Invalid or expired link' };
    if (new Date(record.expiresAt) < new Date()) return { success: false, error: 'Link expired' };

    const failedStatuses = ['error', 'failed', 'transaction.failed', 'transaction_error'];
    if (redirectStatus && failedStatuses.includes(redirectStatus.toLowerCase())) {
      return { success: false, error: 'Payment was not successful' };
    }

    const verify = await this.paymentGatewayManager.verifyKkiaPayTransaction(transactionId);
    if (!verify.success) return { success: false, error: verify.error ?? 'Payment verification failed' };

    try {
      await this.businessRepo.updateTier(record.businessId, record.targetTier);

      if (this.auditLogger) {
        this.auditLogger.log({
          entityType: 'subscription',
          entityId: token,
          businessId: record.businessId,
          action: 'update',
          userId: record.businessId,
          metadata: {
            targetTier: record.targetTier,
            transactionId,
            statusChange: 'confirmed',
          },
        }).catch(() => {});
      }

      return { success: true, businessId: record.businessId };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
