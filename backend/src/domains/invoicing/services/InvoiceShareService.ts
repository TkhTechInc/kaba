import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { InvoiceShareRepository } from '../repositories/InvoiceShareRepository';
import { getBusinessCurrency } from '@/shared/utils/country-currency';
import { InvoiceRepository } from '../repositories/InvoiceRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { InvoiceService } from './InvoiceService';
import { PaymentsClient } from '@/domains/payments/services/PaymentsClient';
import { NotFoundError, ValidationError } from '@/shared/errors/DomainError';
import type { Invoice, InvoiceItem } from '../models/Invoice';

const TTL_DAYS = 7;

export interface PublicInvoicePayResponse {
  invoice: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    items: InvoiceItem[];
    dueDate: string;
    createdAt: string;
  };
  business: { name: string };
  customer: { name: string };
  paymentUrl?: string;
  /** When true, frontend should show KkiaPay widget instead of redirect. */
  useKkiaPayWidget?: boolean;
  /** When true, frontend should show MoMo phone form to request payment (RequestToPay flow). */
  useMomoRequest?: boolean;
  /** Required for KkiaPay verification flow. */
  intentId?: string;
}

@Injectable()
export class InvoiceShareService {
  constructor(
    private readonly invoiceShareRepository: InvoiceShareRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly businessRepository: BusinessRepository,
    private readonly invoiceService: InvoiceService,
    private readonly paymentsClient: PaymentsClient,
    private readonly configService: ConfigService
  ) {}

  /**
   * Generate a wa.me share link for sending an invoice to a customer via WhatsApp.
   * Creates a share token and uses the pay URL in the pre-filled message.
   */
  async generateWhatsAppShareLink(
    businessId: string,
    invoiceId: string
  ): Promise<{ url: string }> {
    const { payUrl } = await this.generatePublicToken(invoiceId, businessId);

    const invoice = await this.invoiceRepository.getById(businessId, invoiceId);
    if (!invoice) throw new NotFoundError('Invoice', invoiceId);

    const customer = await this.customerRepository.getById(businessId, invoice.customerId);
    if (!customer) throw new NotFoundError('Customer', invoice.customerId);

    const phone = customer.phone?.trim();
    if (!phone) {
      throw new ValidationError(
        'Customer has no phone number. Add a phone number to share invoices via WhatsApp.'
      );
    }

    const business = await this.businessRepository.getById(businessId);
    const businessName = business?.name ?? 'Your Business';
    const customerName = customer.name ?? 'there';
    const countryCode = business?.countryCode ?? undefined;

    const normalizedPhone = this.normalizePhone(phone, countryCode);
    if (!normalizedPhone) {
      throw new ValidationError(
        'Invalid phone number format. Please use E.164 format (e.g. +2348012345678) or add the customer\'s country code.'
      );
    }

    const text = [
      `Hello ${customerName},`,
      '',
      `${businessName} has sent you invoice #${invoice.id.slice(0, 8)} for ${invoice.amount} ${invoice.currency}.`,
      '',
      `View and pay here: ${payUrl}`,
      '',
      '— Sent via Kaba',
    ].join('\n');

    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/${normalizedPhone.replace(/^\+/, '')}?text=${encodedText}`;

    return { url };
  }

  /**
   * Normalize a phone number to E.164 format.
   *
   * Priority:
   * 1. Already E.164 (+countrycode digits) → return as-is after stripping non-digits
   * 2. Local number starting with 0 → strip leading 0, prepend country dialing code
   * 3. Correct digit length for a known country and no leading 0 → prepend dialing code
   * 4. Fallback: return null (caller shows validation error)
   *
   * countryCode is ISO 3166-1 alpha-2 (NG, GH, BJ, CI, SN, CM, etc.)
   */
  private normalizePhone(phone: string, countryCode?: string): string | null {
    const trimmed = phone.trim();

    // Already E.164 — starts with + and has 7–15 digits after it
    if (/^\+\d{7,15}$/.test(trimmed)) {
      return trimmed;
    }

    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return null;

    // West Africa dialing code table (ISO 3166-1 alpha-2 → [dialingCode, localDigits])
    // localDigits: expected total digits after stripping leading 0 (without country code)
    const dialingTable: Record<string, { code: string; localLen: number }> = {
      NG: { code: '234', localLen: 10 }, // Nigeria: 080XXXXXXXX → +234 80XXXXXXXX
      GH: { code: '233', localLen: 9  }, // Ghana: 024XXXXXXX → +233 24XXXXXXX
      BJ: { code: '229', localLen: 8  }, // Benin: 97XXXXXX → +229 97XXXXXX
      CI: { code: '225', localLen: 10 }, // Côte d'Ivoire: 07XXXXXXXX → +225 07XXXXXXXX
      SN: { code: '221', localLen: 9  }, // Senegal: 77XXXXXXX → +221 77XXXXXXX
      ML: { code: '223', localLen: 8  }, // Mali: 7XXXXXXX → +223 7XXXXXXX
      BF: { code: '226', localLen: 8  }, // Burkina Faso: 70XXXXXX → +226 70XXXXXX
      TG: { code: '228', localLen: 8  }, // Togo: 90XXXXXX → +228 90XXXXXX
      NE: { code: '227', localLen: 8  }, // Niger: 90XXXXXX → +227 90XXXXXX
      CM: { code: '237', localLen: 9  }, // Cameroon: 6XXXXXXXX → +237 6XXXXXXXX
      GN: { code: '224', localLen: 9  }, // Guinea: 6XXXXXXXX → +224 6XXXXXXXX
    };

    const entry = countryCode ? dialingTable[countryCode.toUpperCase()] : undefined;

    if (entry) {
      const localDigits = digits.startsWith('0') ? digits.slice(1) : digits;
      if (localDigits.length === entry.localLen) {
        return `+${entry.code}${localDigits}`;
      }
      // If already includes country code prefix
      if (digits.startsWith(entry.code) && digits.length === entry.code.length + entry.localLen) {
        return `+${digits}`;
      }
    }

    // No country context — try to infer from leading 0 (common West Africa pattern)
    if (digits.startsWith('0') && digits.length >= 9) {
      // Cannot determine country without context; return null to force E.164 entry
      return null;
    }

    // Last resort: if it looks like a full international number (9–15 digits, no leading 0)
    if (!digits.startsWith('0') && digits.length >= 9) {
      return `+${digits}`;
    }

    return null;
  }

  /**
   * Generate (or reuse) a public share token for an invoice.
   * If a valid token exists for this invoice (not expired, not expiring within 1 hour),
   * it is returned as-is. Otherwise a new 7-day token is minted.
   */
  async generatePublicToken(
    invoiceId: string,
    businessId: string
  ): Promise<{ token: string; payUrl: string }> {
    const invoice = await this.invoiceRepository.getById(businessId, invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    const baseUrl =
      this.configService.get<string>('oauth.frontendUrl') ??
      process.env.FRONTEND_URL ??
      process.env.APP_URL ??
      'http://localhost:3000';

    // Reuse existing valid token if it won't expire within 1 hour
    const existing = await this.invoiceShareRepository.getByInvoiceId(invoiceId);
    if (existing) {
      const expiresAt = new Date(existing.expiresAt);
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      if (expiresAt > oneHourFromNow && existing.businessId === businessId) {
        const payUrl = `${baseUrl.replace(/\/$/, '')}/pay/${existing.token}`;
        return { token: existing.token, payUrl };
      }
    }

    const token = uuidv4();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + TTL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    await this.invoiceShareRepository.create(token, invoiceId, businessId, expiresAt);

    const payUrl = `${baseUrl.replace(/\/$/, '')}/pay/${token}`;
    return { token, payUrl };
  }

  /**
   * Get invoice details by public token for the payment portal.
   * Returns invoice, business, customer info and paymentUrl for unpaid invoices.
   */
  async getInvoiceByToken(token: string): Promise<PublicInvoicePayResponse | null> {
    const record = await this.invoiceShareRepository.getByToken(token);
    if (!record) return null;

    if (new Date(record.expiresAt) < new Date()) return null;

    const invoice = await this.invoiceRepository.getById(
      record.businessId,
      record.invoiceId
    );
    if (!invoice || invoice.deletedAt) return null;

    const [business, customer] = await Promise.all([
      this.businessRepository.getById(record.businessId),
      this.customerRepository.getById(record.businessId, invoice.customerId),
    ]);

    let paymentUrl: string | undefined;
    let intentId: string | undefined;
    let useKkiaPayWidget = false;
    let useMomoRequest = false;
    const forceKkiaPayUi = process.env['KKIAPAY_TEST_FORCE_UI'] === 'true';
    if (invoice.status !== 'paid' && invoice.status !== 'cancelled') {
      const currency = invoice.currency?.toUpperCase() ?? '';
      try {
        const payConfig = await this.paymentsClient.getPayConfig(currency, business?.countryCode);
        useKkiaPayWidget = payConfig.useKkiaPayWidget;
        useMomoRequest = payConfig.useMomoRequest;
      } catch {
        // TKH Payments unavailable; fallback to payment link only
      }
      if (useKkiaPayWidget) {
        try {
          const intent = await this.paymentsClient.createIntent({
            amount: invoice.amount,
            currency,
            country: business?.countryCode,
            metadata: {
              appId: 'kaba',
              referenceId: invoice.id,
              businessId: record.businessId,
              invoiceId: record.invoiceId,
              customerId: invoice.customerId ?? undefined,
              customerEmail: customer?.email ?? undefined,
              phoneNumber: customer?.phone ?? business?.phone ?? undefined,
            },
          });
          if (intent.success) {
            intentId = intent.intentId;
            paymentUrl = intent.paymentUrl;
          }
        } catch {
          // fall through; UI can still show other methods
        }
      }
      if (forceKkiaPayUi && !intentId) {
        intentId = `dev-kkiapay-${record.token}`;
      }
      const widgetReady = useKkiaPayWidget && !!intentId;
      useKkiaPayWidget = widgetReady;
      if (!widgetReady && !useMomoRequest) {
        try {
          const link = await this.invoiceService.generatePaymentLink(
            record.businessId,
            record.invoiceId
          );
          paymentUrl = link.paymentUrl;
        } catch {
          paymentUrl = undefined;
        }
      }
    }

    return {
      invoice: this.toPublicInvoice(invoice),
      business: { name: business?.name ?? 'Business' },
      customer: { name: customer?.name ?? 'Customer' },
      ...(paymentUrl && { paymentUrl }),
      ...(useKkiaPayWidget && { useKkiaPayWidget }),
      ...(useMomoRequest && { useMomoRequest }),
      ...(intentId && { intentId }),
    };
  }

  /**
   * Request MoMo payment (RequestToPay). Sends a payment request to the customer's phone.
   * Customer approves on their phone; webhook marks invoice paid when successful.
   */
  async requestMoMoPayment(token: string, phone: string): Promise<{ success: boolean; error?: string }> {
    const record = await this.invoiceShareRepository.getByToken(token);
    if (!record) return { success: false, error: 'Invalid or expired link' };
    if (!record.invoiceId?.trim() || !record.businessId?.trim()) {
      return { success: false, error: 'Invalid payment link' };
    }
    if (new Date(record.expiresAt) < new Date()) return { success: false, error: 'Link expired' };

    const invoice = await this.invoiceRepository.getById(record.businessId, record.invoiceId);
    if (!invoice || invoice.deletedAt) return { success: false, error: 'Invoice not found' };
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return { success: false, error: 'Invoice is already paid or cancelled' };
    }

    const business = await this.businessRepository.getById(record.businessId);
    const normalizedPhone = this.normalizePhone(phone.trim(), business?.countryCode);
    if (!normalizedPhone) {
      return { success: false, error: 'Invalid phone number. Use E.164 format (e.g. +233241234567)' };
    }

    const amount = invoice.amount;
    const currency = invoice.currency ?? (business ? getBusinessCurrency(business) : 'XOF');
    const externalId = `qb-${record.businessId}-${record.invoiceId}-${Date.now()}`;

    const response = await this.paymentsClient.requestMoMoPayment({
      amount,
      currency,
      phone: normalizedPhone,
      countryCode: business?.countryCode,
      metadata: {
        businessId: record.businessId,
        invoiceId: record.invoiceId,
        paymentIntentId: externalId,
      },
    });
    return response;
  }

  /**
   * Confirm KkiaPay widget payment. Verifies transaction with KkiaPay, then marks invoice paid.
   * @param redirectStatus - Optional status from KkiaPay redirect URL (e.g. "error", "transaction.failed").
   *   If present and indicates failure, we reject without calling the API. Use ?transaction_status=failed for testing.
   */
  async confirmKkiaPayPayment(
    token: string,
    transactionId: string,
    intentId: string,
    redirectStatus?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const record = await this.invoiceShareRepository.getByToken(token);
    if (!record) return { success: false, error: 'Invalid or expired link' };
    if (!record.invoiceId?.trim() || !record.businessId?.trim()) {
      return { success: false, error: 'Invalid payment link' };
    }
    if (new Date(record.expiresAt) < new Date()) return { success: false, error: 'Link expired' };

    const failedStatuses = ['error', 'failed', 'transaction.failed', 'transaction_error'];
    if (redirectStatus && failedStatuses.includes(redirectStatus.toLowerCase())) {
      return { success: false, error: 'Payment was not successful' };
    }

    const verify = await this.paymentsClient.verifyKkiaPayTransaction(transactionId, intentId);
    if (!verify.success) return { success: false, error: verify.error ?? 'Payment verification failed' };

    try {
      await this.invoiceService.markPaidFromWebhook(record.businessId, record.invoiceId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  private toPublicInvoice(invoice: Invoice): PublicInvoicePayResponse['invoice'] {
    return {
      id: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      items: invoice.items,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
    };
  }
}
