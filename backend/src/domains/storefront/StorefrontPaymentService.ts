import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { StorefrontPaymentRepository } from './StorefrontPaymentRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { PaymentsClient } from '@/domains/payments/services/PaymentsClient';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { NotFoundError, ValidationError } from '@/shared/errors/DomainError';

@Injectable()
export class StorefrontPaymentService {
  constructor(
    private readonly storefrontPaymentRepo: StorefrontPaymentRepository,
    private readonly businessRepo: BusinessRepository,
    private readonly paymentsClient: PaymentsClient,
    private readonly ledgerRepo: LedgerRepository,
  ) {}

  /** Create checkout session for storefront payment. Returns token and pay URL. */
  async createCheckout(
    slug: string,
    amount: number,
    currency: string,
    baseUrl: string,
    options?: { description?: string; customerName?: string; customerEmail?: string },
  ): Promise<{
    token: string;
    payUrl: string;
    amount: number;
    currency: string;
    useKkiaPayWidget: boolean;
    useMomoRequest: boolean;
  }> {
    const business = await this.businessRepo.getBySlug(slug);
    if (!business) throw new NotFoundError('Business', slug);

    const normalizedCurrency = (currency ?? business.currency ?? 'XOF').toUpperCase();

    if (!amount || amount <= 0) {
      throw new ValidationError('Amount must be a positive number');
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await this.storefrontPaymentRepo.create({
      token,
      slug,
      businessId: business.id,
      amount,
      currency: normalizedCurrency,
      description: options?.description,
      customerName: options?.customerName,
      customerEmail: options?.customerEmail,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    const payUrl = `${baseUrl.replace(/\/$/, '')}/pay/storefront/${token}`;

    const payConfig = await this.paymentsClient.getPayConfig(normalizedCurrency, business?.countryCode);
    const useKkiaPayWidget = payConfig.useKkiaPayWidget;
    const useMomoRequest = payConfig.useMomoRequest;

    return { token, payUrl, amount, currency: normalizedCurrency, useKkiaPayWidget, useMomoRequest };
  }

  /** Get storefront payment data for pay page (public, no auth). */
  async getPayData(token: string): Promise<{
    businessName: string;
    amount: number;
    currency: string;
    useKkiaPayWidget: boolean;
    useMomoRequest: boolean;
    intentId?: string;
    paid?: boolean;
  } | null> {
    const record = await this.storefrontPaymentRepo.getByToken(token);
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
          referenceId: `storefront-${record.token}`,
          businessId: record.businessId,
          phoneNumber: business?.phone ?? undefined,
          ...(record.customerEmail ? { customerEmail: record.customerEmail } : {}),
          ...(record.customerName ? { customerName: record.customerName } : {}),
          ...(record.description ? { description: record.description } : {}),
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

    return {
      businessName: business?.name ?? 'Business',
      amount: record.amount,
      currency: record.currency,
      useKkiaPayWidget,
      useMomoRequest,
      intentId,
    };
  }

  /** Request MoMo payment for storefront. Sends RequestToPay to customer's phone. */
  async requestMoMoPayment(token: string, phone: string): Promise<{ success: boolean; error?: string }> {
    const record = await this.storefrontPaymentRepo.getByToken(token);
    if (!record) return { success: false, error: 'Invalid or expired link' };
    if (new Date(record.expiresAt) < new Date()) return { success: false, error: 'Link expired' };

    const business = await this.businessRepo.getById(record.businessId);
    const normalizedPhone = this.normalizePhone(phone.trim(), business?.countryCode);
    if (!normalizedPhone) {
      return { success: false, error: 'Invalid phone number. Use E.164 format (e.g. +233241234567)' };
    }

    const amount = record.amount;
    const currency = record.currency ?? 'XOF';
    const externalId = `qb-storefront-${record.token}-${Date.now()}`;

    const response = await this.paymentsClient.requestMoMoPayment({
      amount,
      currency,
      phone: normalizedPhone,
      countryCode: business?.countryCode,
      metadata: {
        businessId: record.businessId,
        referenceId: `storefront-${record.token}`,
        paymentIntentId: externalId,
      },
    });
    return response;
  }

  /** Confirm MoMo payment (called from webhook). Creates ledger entry. */
  async confirmMoMoPayment(token: string): Promise<{ success: boolean; error?: string }> {
    const record = await this.storefrontPaymentRepo.getByToken(token);
    if (!record) return { success: false, error: 'Invalid or expired link' };
    if (new Date(record.expiresAt) < new Date()) return { success: false, error: 'Link expired' };

    try {
      const today = new Date().toISOString().slice(0, 10);
      await this.ledgerRepo.create({
        businessId: record.businessId,
        type: 'sale',
        amount: record.amount,
        currency: record.currency,
        description: record.description ?? `Storefront payment (${record.slug})`,
        category: 'Sales',
        date: today,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /** Confirm KkiaPay widget payment. Verifies transaction, then creates ledger entry. */
  async confirmKkiaPayPayment(
    token: string,
    transactionId: string,
    intentId: string,
    redirectStatus?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const record = await this.storefrontPaymentRepo.getByToken(token);
    if (!record) return { success: false, error: 'Invalid or expired link' };
    if (new Date(record.expiresAt) < new Date()) return { success: false, error: 'Link expired' };

    const failedStatuses = ['error', 'failed', 'transaction.failed', 'transaction_error'];
    if (redirectStatus && failedStatuses.includes(redirectStatus.toLowerCase())) {
      return { success: false, error: 'Payment was not successful' };
    }

    const verify = await this.paymentsClient.verifyKkiaPayTransaction(transactionId, intentId);
    if (!verify.success) return { success: false, error: verify.error ?? 'Payment verification failed' };

    try {
      const today = new Date().toISOString().slice(0, 10);
      await this.ledgerRepo.create({
        businessId: record.businessId,
        type: 'sale',
        amount: record.amount,
        currency: record.currency,
        description: record.description ?? `Storefront payment (${record.slug})`,
        category: 'Sales',
        date: today,
      });
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
}
