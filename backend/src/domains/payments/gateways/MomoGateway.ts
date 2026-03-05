/**
 * MTN Mobile Money (MoMo) Gateway — West Africa
 * Async push flow: backend initiates → user approves on phone → webhook resolves status.
 * Requires: MOMO_API_KEY, MOMO_SUBSCRIPTION_KEY
 * Optional: MOMO_API_USER, MOMO_BASE_URL, MOMO_TARGET_ENV, MOMO_WEBHOOK_SECRET
 */

import * as crypto from 'crypto';
import type { IPaymentGateway, PaymentGatewayType } from '../interfaces/IPaymentGateway';
import type { CreatePaymentIntentRequest, PaymentGatewayResponse } from '../models/Payment';

const MOMO_DEFAULT_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';

function toMsisdn(phone: string): string {
  return phone.replace(/\D/g, '');
}

export class MomoGateway implements IPaymentGateway {
  readonly gatewayType: PaymentGatewayType = 'momo';

  private readonly apiKey: string;
  private readonly subscriptionKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string;

  private readonly supportedCurrencies = ['XOF', 'XAF', 'GNF', 'GHS'];

  constructor(apiKey: string, subscriptionKey: string, webhookSecret = '', baseUrl?: string) {
    this.apiKey = apiKey;
    this.subscriptionKey = subscriptionKey;
    this.webhookSecret = webhookSecret;
    this.baseUrl = (baseUrl ?? process.env['MOMO_BASE_URL'] ?? MOMO_DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  private async getToken(): Promise<string | null> {
    const apiUser = process.env['MOMO_API_USER'];
    if (!apiUser) {
      // Without MOMO_API_USER we cannot exchange credentials for a Bearer token.
      // Return null to signal misconfiguration rather than silently using apiKey.
      return null;
    }
    if (!this.apiKey) return null;
    const url = `${this.baseUrl}/collection/token/`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          Authorization: `Basic ${Buffer.from(`${apiUser}:${this.apiKey}`).toString('base64')}`,
        },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { access_token?: string };
      return data.access_token ?? null;
    } catch {
      return null;
    }
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentGatewayResponse> {
    try {
      const phoneNumber = request.metadata?.['phoneNumber'];
      if (!phoneNumber) {
        return { success: false, gatewayTransactionId: '', gatewayResponse: null, error: 'phoneNumber is required in metadata for MoMo' };
      }

      // Encode businessId + invoiceId into externalId so webhook can recover both.
      // Format: qb-<businessId>-<invoiceId>-<timestamp>
      const paymentId = request.metadata?.['paymentIntentId'] || `qb-${request.businessId}-${request.invoiceId}-${Date.now()}`;
      const referenceId = crypto.randomUUID();
      const token = await this.getToken();
      if (!token) {
        return { success: false, gatewayTransactionId: '', gatewayResponse: null, error: 'Failed to obtain MoMo access token' };
      }

      const amount = this.formatAmount(request.amount, request.currency);
      const url = `${this.baseUrl}/collection/v1_0/requesttopay`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': process.env['MOMO_TARGET_ENV'] || 'sandbox',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: String(amount),
          currency: request.currency,
          externalId: paymentId,
          payer: { partyIdType: 'MSISDN', partyId: toMsisdn(phoneNumber as string) },
          payerMessage: 'Invoice payment',
          payeeNote: `Invoice ${request.invoiceId}`,
        }),
      });

      if (res.status === 202 || res.status === 200) {
        return { success: true, gatewayTransactionId: referenceId, gatewayResponse: { referenceId, status: 'pending', externalId: paymentId } };
      }

      const text = await res.text();
      let errMsg: string;
      try { errMsg = (JSON.parse(text) as { message?: string }).message ?? text ?? `MoMo ${res.status}`; } catch { errMsg = text || `MoMo ${res.status}`; }
      return { success: false, gatewayTransactionId: '', gatewayResponse: null, error: errMsg };
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
      const body = JSON.parse(payload) as { status?: string; externalId?: string };
      const status = (body.status ?? '').toUpperCase();
      const success = status === 'SUCCESSFUL';
      // Parse businessId + invoiceId from externalId format: qb-<businessId>-<invoiceId>-<timestamp>
      const externalId = body.externalId ?? '';
      let invoiceId: string | undefined;
      let businessId: string | undefined;
      if (externalId.startsWith('qb-')) {
        const withoutPrefix = externalId.slice(3);            // "<businessId>-<invoiceId>-<timestamp>"
        const withoutTimestamp = withoutPrefix.replace(/-\d+$/, ''); // "<businessId>-<invoiceId>"
        const dashIdx = withoutTimestamp.indexOf('-');
        if (dashIdx !== -1) {
          businessId = withoutTimestamp.slice(0, dashIdx) || undefined;
          invoiceId = withoutTimestamp.slice(dashIdx + 1) || undefined;
        } else {
          invoiceId = withoutTimestamp || undefined;
        }
      } else {
        invoiceId = externalId || undefined;
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
