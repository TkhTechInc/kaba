/**
 * KkiaPay Gateway — West Africa (Benin, Togo, Ivory Coast)
 * Async push flow: backend initiates → user approves on phone → webhook resolves status.
 * Requires: KKIAPAY_PRIVATE_KEY (server API Bearer token)
 * Optional: KKIAPAY_WEBHOOK_SECRET, KKIAPAY_BASE_URL
 */

import * as crypto from 'crypto';
import type { IPaymentGateway, PaymentGatewayType } from '../interfaces/IPaymentGateway';
import type { CreatePaymentIntentRequest, PaymentGatewayResponse } from '../models/Payment';

const KKIAPAY_BASE_URL = 'https://api.kkiapay.me';
const KKIAPAY_REQUEST_PATH = '/api/v1/transactions/request-payment';
const KKIAPAY_GET_STATUS_PATH = '/api/v1/transactions';

export class KkiaPayGateway implements IPaymentGateway {
  readonly gatewayType: PaymentGatewayType = 'kkiapay';

  private readonly privateKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string;
  private readonly sandbox: boolean;

  private readonly supportedCurrencies = ['XOF', 'XAF', 'GNF'];

  constructor(privateKey: string, webhookSecret = '', baseUrl?: string, sandbox?: boolean) {
    this.privateKey = privateKey;
    this.webhookSecret = webhookSecret;
    this.baseUrl = (baseUrl ?? process.env['KKIAPAY_BASE_URL'] ?? KKIAPAY_BASE_URL).replace(/\/$/, '');
    this.sandbox = sandbox ?? process.env['KKIAPAY_SANDBOX'] === 'true';
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentGatewayResponse> {
    try {
      const phoneNumber = request.metadata?.['phoneNumber'];
      if (!phoneNumber) {
        return { success: false, gatewayTransactionId: '', gatewayResponse: null, error: 'phoneNumber is required in metadata for KkiaPay' };
      }

      // Encode businessId + invoiceId into reference so webhook can recover both.
      // Format: qb-<businessId>-<invoiceId>-<timestamp>
      const paymentId = request.metadata?.['paymentIntentId'] || `qb-${request.businessId}-${request.invoiceId}-${Date.now()}`;
      const amount = this.formatAmount(request.amount, request.currency);
      const url = `${this.baseUrl}${KKIAPAY_REQUEST_PATH}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.privateKey}`,
        },
        body: JSON.stringify({
          amount: String(amount),
          currency: request.currency,
          reference: paymentId,
          customer_phone_number: (phoneNumber as string).replace(/\s/g, ''),
          // stateData echoed back in webhook — ensures we can recover businessId/invoiceId
          stateData: { reference: paymentId },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { transaction_id?: string; id?: string; error?: string };

      if (!res.ok) {
        return { success: false, gatewayTransactionId: '', gatewayResponse: data, error: data.error ?? `KkiaPay ${res.status}` };
      }

      const txId = data.transaction_id ?? data.id ?? paymentId;
      return { success: true, gatewayTransactionId: String(txId), gatewayResponse: { ...data, reference: paymentId } };
    } catch (err) {
      return { success: false, gatewayTransactionId: '', gatewayResponse: null, error: (err as Error).message };
    }
  }

  isCurrencySupported(currency: string): boolean {
    return this.supportedCurrencies.includes(currency.toUpperCase());
  }

  getSupportedCurrencies(): string[] {
    return [...this.supportedCurrencies];
  }

  /**
   * Verify transaction status with KkiaPay (for widget flow).
   * GET /api/v1/transactions/:id
   */
  async getPaymentStatus(transactionId: string): Promise<{ success: boolean; error?: string }> {
    if (!transactionId?.trim()) {
      return { success: false, error: 'transactionId is required' };
    }
    try {
      const path = `${KKIAPAY_GET_STATUS_PATH}/${encodeURIComponent(transactionId.trim())}`;
      const url = `${this.baseUrl}${path}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.privateKey}` },
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (!res.ok) {
        // Sandbox: KkiaPay status API may return 404 for widget transactions. Trust the redirect.
        if (this.sandbox && res.status === 404) {
          return { success: true };
        }
        return { success: false, error: data.error ?? `KkiaPay ${res.status}` };
      }
      const status = (data.status ?? '').toUpperCase();
      const success = status === 'SUCCESS' || status === 'COMPLETED';
      return { success, error: success ? undefined : (data.error ?? 'Payment not successful') };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async handleWebhook(payload: string, signature?: string): Promise<{ success: boolean; invoiceId?: string; businessId?: string }> {
    if (this.webhookSecret) {
      if (!signature) return { success: false };
      const expected = crypto.createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
      try {
        if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
          return { success: false };
        }
      } catch {
        return { success: false };
      }
    }

    try {
      const body = JSON.parse(payload) as {
        status?: string;
        reference?: string;
        business_id?: string;
        isPaymentSucces?: boolean;
        event?: string;
        stateData?: { reference?: string };
      };

      // KkiaPay docs: isPaymentSucces (boolean) and event (transaction.success | transaction.failed)
      // Legacy: status (SUCCESS | COMPLETED)
      const success =
        body.isPaymentSucces === true ||
        body.event === 'transaction.success' ||
        (body.status ?? '').toUpperCase() === 'SUCCESS' ||
        (body.status ?? '').toUpperCase() === 'COMPLETED';

      // Reference: we send qb-<businessId>-<invoiceId>-<timestamp> in createPaymentIntent.
      // KkiaPay may echo it in reference, stateData.reference, or not at all.
      const refFromState =
        typeof body.stateData === 'object' && body.stateData?.reference
          ? String(body.stateData.reference)
          : '';
      const reference = body.reference ?? refFromState ?? '';

      let invoiceId: string | undefined;
      let businessId: string | undefined = body.business_id;
      if (reference.startsWith('qb-')) {
        const withoutPrefix = reference.slice(3);
        const withoutTimestamp = withoutPrefix.replace(/-\d+$/, '');
        const dashIdx = withoutTimestamp.indexOf('-');
        if (dashIdx !== -1) {
          businessId = businessId || withoutTimestamp.slice(0, dashIdx) || undefined;
          invoiceId = withoutTimestamp.slice(dashIdx + 1) || undefined;
        } else {
          invoiceId = withoutTimestamp || undefined;
        }
      } else if (reference) {
        invoiceId = reference;
      }

      return { success, invoiceId, businessId };
    } catch {
      return { success: false };
    }
  }

  private formatAmount(amount: number, currency: string): number {
    const noCents = ['XOF', 'XAF', 'GNF', 'XPF'];
    return noCents.includes(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
  }
}

