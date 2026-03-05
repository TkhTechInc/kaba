/**
 * Paystack Gateway — West Africa (Nigeria, Ghana, South Africa)
 * Redirect flow: backend initializes → user pays at authorization_url → webhook confirms.
 * Requires: PAYSTACK_SECRET_KEY
 * Optional: PAYSTACK_WEBHOOK_SECRET
 * API: https://paystack.com/docs/api/
 */

import * as crypto from 'crypto';
import type { IPaymentGateway, PaymentGatewayType } from '../interfaces/IPaymentGateway';
import type { CreatePaymentIntentRequest, PaymentGatewayResponse } from '../models/Payment';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export class PaystackGateway implements IPaymentGateway {
  readonly gatewayType: PaymentGatewayType = 'paystack';

  private readonly secretKey: string;
  private readonly webhookSecret: string;

  private readonly supportedCurrencies = ['NGN', 'GHS', 'ZAR', 'USD'];

  constructor(secretKey: string, webhookSecret = '') {
    this.secretKey = secretKey;
    this.webhookSecret = webhookSecret;
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentGatewayResponse> {
    try {
      // Format: qb-<businessId>-<invoiceId>-<timestamp> (same as KkiaPay)
      const reference = request.metadata?.['paymentIntentId'] ?? `qb-${request.businessId}-${request.invoiceId}-${Date.now()}`;
      const amountInMinor = this.formatAmount(request.amount, request.currency);
      const email = request.metadata?.['email'] ?? request.metadata?.['customerEmail'] ?? 'customer@quickbooks.local';

      const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify({
          amount: amountInMinor,
          email,
          reference,
          currency: request.currency,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        status?: boolean;
        data?: { reference?: string; authorization_url?: string; access_code?: string };
        message?: string;
      };

      if (!res.ok || !json.status) {
        return {
          success: false,
          gatewayTransactionId: '',
          gatewayResponse: json,
          error: json.message ?? `Paystack ${res.status}`,
        };
      }

      const data = json.data ?? {};
      const authorizationUrl = data.authorization_url ?? '';

      return {
        success: true,
        gatewayTransactionId: data.reference ?? reference,
        gatewayResponse: { authorization_url: authorizationUrl, access_code: data.access_code, reference },
        paymentUrl: authorizationUrl,
      };
    } catch (err) {
      return {
        success: false,
        gatewayTransactionId: '',
        gatewayResponse: null,
        error: (err as Error).message,
      };
    }
  }

  isCurrencySupported(currency: string): boolean {
    return this.supportedCurrencies.includes(currency.toUpperCase());
  }

  getSupportedCurrencies(): string[] {
    return [...this.supportedCurrencies];
  }

  async handleWebhook(payload: string, signature?: string): Promise<{ success: boolean; invoiceId?: string; businessId?: string }> {
    const secret = this.webhookSecret || this.secretKey;
    if (secret) {
      if (!signature) return { success: false };
      const expected = crypto.createHmac('sha512', secret).update(payload).digest('hex');
      try {
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expected, 'hex');
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
          return { success: false };
        }
      } catch {
        return { success: false };
      }
    }

    try {
      const body = JSON.parse(payload) as { event?: string; data?: { reference?: string } };
      if (body.event !== 'charge.success') {
        return { success: false };
      }

      const reference = body.data?.reference ?? '';
      const { businessId, invoiceId } = this.parseReference(reference);
      return { success: true, invoiceId, businessId };
    } catch {
      return { success: false };
    }
  }

  private parseReference(reference: string): { businessId?: string; invoiceId?: string } {
    if (!reference.startsWith('qb-')) {
      return { invoiceId: reference || undefined };
    }
    const withoutPrefix = reference.slice(3);
    const withoutTimestamp = withoutPrefix.replace(/-\d+$/, '');
    const dashIdx = withoutTimestamp.indexOf('-');
    if (dashIdx !== -1) {
      return {
        businessId: withoutTimestamp.slice(0, dashIdx) || undefined,
        invoiceId: withoutTimestamp.slice(dashIdx + 1) || undefined,
      };
    }
    return { invoiceId: withoutTimestamp || undefined };
  }

  /**
   * Paystack amounts: NGN/GHS in minor units (kobo/pesewas), ZAR/USD in cents.
   * All use 100x multiplier.
   */
  private formatAmount(amount: number, currency: string): number {
    return Math.round(amount * 100);
  }
}
