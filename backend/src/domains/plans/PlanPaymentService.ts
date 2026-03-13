import { Injectable, Inject, Optional } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PlanPaymentRepository } from './PlanPaymentRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { PaymentsClient } from '@/domains/payments/services/PaymentsClient';
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
    private readonly paymentsClient: PaymentsClient,
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

    const payConfig = await this.paymentsClient.getPayConfig(currency, business?.countryCode);
    const useKkiaPayWidget = payConfig.useKkiaPayWidget;

    return { token, payUrl, amount, currency, useKkiaPayWidget };
  }

  /** Get plan payment data for pay page (public, no auth). */
  async getPayData(token: string): Promise<{
    businessName: string;
    targetTier: string;
    amount: number;
    currency: string;
    useKkiaPayWidget: boolean;
    useMomoRequest: boolean;
    intentId?: string;
    upgraded?: boolean;
  } | null> {
    const record = await this.planPaymentRepo.getByToken(token);
    if (!record) return null;
    if (new Date(record.expiresAt) < new Date()) return null;

    const business = await this.businessRepo.getById(record.businessId);
    const currency = record.currency?.toUpperCase() ?? '';

    const payConfig = await this.paymentsClient.getPayConfig(currency, business?.countryCode);
    let useKkiaPayWidget = payConfig.useKkiaPayWidget;
    const useMomoRequest = payConfig.useMomoRequest;
    const forceKkiaPayUi = process.env['KKIAPAY_TEST_FORCE_UI'] === 'true';
    let intentId: string | undefined;
    if (useKkiaPayWidget) {
      const intent = await this.paymentsClient.createIntent({
        amount: record.amount,
        currency: record.currency,
        country: business?.countryCode,
        metadata: {
          appId: 'kaba',
          referenceId: `plan-${record.token}`,
          businessId: record.businessId,
          phoneNumber: business?.phone ?? undefined,
        },
      });
      if (intent.success) {
        intentId = intent.intentId;
      }
    }
    if (forceKkiaPayUi && !intentId) {
      intentId = `dev-kkiapay-${record.token}`;
    }
    useKkiaPayWidget = useKkiaPayWidget && !!intentId;

    const upgraded =
      business &&
      tierIndex(business.tier ?? 'free') >= tierIndex(record.targetTier);

    return {
      businessName: business?.name ?? 'Business',
      targetTier: record.targetTier,
      amount: record.amount,
      currency: record.currency,
      useKkiaPayWidget,
      useMomoRequest,
      intentId,
      upgraded: !!upgraded,
    };
  }

  /** Request MoMo payment for plan upgrade. Sends RequestToPay to customer's phone. */
  async requestMoMoPayment(token: string, phone: string): Promise<{ success: boolean; error?: string }> {
    const record = await this.planPaymentRepo.getByToken(token);
    if (!record) return { success: false, error: 'Invalid or expired link' };
    if (new Date(record.expiresAt) < new Date()) return { success: false, error: 'Link expired' };

    const business = await this.businessRepo.getById(record.businessId);
    const normalizedPhone = this.normalizePhone(phone.trim(), business?.countryCode);
    if (!normalizedPhone) {
      return { success: false, error: 'Invalid phone number. Use E.164 format (e.g. +233241234567)' };
    }

    const amount = record.amount;
    const currency = record.currency ?? 'XOF';
    const externalId = `qb-plan-${record.token}-${Date.now()}`;

    const response = await this.paymentsClient.requestMoMoPayment({
      amount,
      currency,
      phone: normalizedPhone,
      countryCode: business?.countryCode,
      metadata: {
        businessId: record.businessId,
        referenceId: `plan-${record.token}`,
        paymentIntentId: externalId,
      },
    });
    return response;
  }

  /** Confirm MoMo payment (called from webhook). Updates business tier. */
  async confirmMoMoPayment(token: string): Promise<{ success: boolean; error?: string }> {
    const record = await this.planPaymentRepo.getByToken(token);
    if (!record) return { success: false, error: 'Invalid or expired link' };
    if (new Date(record.expiresAt) < new Date()) return { success: false, error: 'Link expired' };

    try {
      await this.businessRepo.updateTier(record.businessId, record.targetTier);

      if (this.auditLogger) {
        this.auditLogger.log({
          entityType: 'subscription',
          entityId: token,
          businessId: record.businessId,
          action: 'update',
          userId: record.businessId,
          metadata: { targetTier: record.targetTier, statusChange: 'confirmed', gateway: 'momo' },
        }).catch(() => {});
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  private normalizePhone(phone: string, countryCode?: string): string | null {
    const trimmed = phone.trim();
    if (/^\+\d{7,15}$/.test(trimmed)) return trimmed;
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return null;
    const dialingTable: Record<string, { code: string; localLen: number }> = {
      NG: { code: '234', localLen: 10 }, GH: { code: '233', localLen: 9 }, BJ: { code: '229', localLen: 8 },
      CI: { code: '225', localLen: 10 }, SN: { code: '221', localLen: 9 }, ML: { code: '223', localLen: 8 },
      BF: { code: '226', localLen: 8 }, TG: { code: '228', localLen: 8 }, NE: { code: '227', localLen: 8 },
      CM: { code: '237', localLen: 9 }, GN: { code: '224', localLen: 9 },
    };
    const entry = countryCode ? dialingTable[countryCode.toUpperCase()] : undefined;
    if (entry) {
      const localDigits = digits.startsWith('0') ? digits.slice(1) : digits;
      if (localDigits.length === entry.localLen) return `+${entry.code}${localDigits}`;
      if (digits.startsWith(entry.code) && digits.length === entry.code.length + entry.localLen) {
        return `+${digits}`;
      }
    }
    if (!digits.startsWith('0') && digits.length >= 9) return `+${digits}`;
    return null;
  }

  /** Confirm KkiaPay payment and update tier. */
  async confirmKkiaPayPayment(
    token: string,
    transactionId: string,
    intentId: string,
    redirectStatus?: string,
  ): Promise<{ success: boolean; error?: string; businessId?: string }> {
    const record = await this.planPaymentRepo.getByToken(token);
    if (!record) return { success: false, error: 'Invalid or expired link' };
    if (new Date(record.expiresAt) < new Date()) return { success: false, error: 'Link expired' };

    const failedStatuses = ['error', 'failed', 'transaction.failed', 'transaction_error'];
    if (redirectStatus && failedStatuses.includes(redirectStatus.toLowerCase())) {
      return { success: false, error: 'Payment was not successful' };
    }

    const verify = await this.paymentsClient.verifyKkiaPayTransaction(transactionId, intentId);
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
