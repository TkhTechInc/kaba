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

/** Approximate rates to EUR for sandbox (MTN sandbox only accepts EUR). Used when MOMO_TARGET_ENV=sandbox. */
const SANDBOX_EUR_RATES: Record<string, number> = {
  XOF: 655.957,
  XAF: 655.957,
  GNF: 9000,
  GHS: 15,
};

function toMsisdn(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** When sandbox, convert non-EUR to EUR for API (sandbox only accepts EUR). */
function toSandboxCurrency(amount: number, currency: string): { amount: number; currency: string } {
  const targetEnv = process.env['MOMO_TARGET_ENV'] || 'sandbox';
  if (targetEnv !== 'sandbox') return { amount, currency };
  const uc = currency.toUpperCase();
  if (uc === 'EUR') return { amount, currency };
  const rate = SANDBOX_EUR_RATES[uc];
  if (!rate) return { amount, currency };
  return { amount: Math.round((amount / rate) * 100) / 100, currency: 'EUR' };
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

      const { amount: apiAmount, currency: apiCurrency } = toSandboxCurrency(request.amount, request.currency);
      // MTN API expects amount in major units (e.g. "5.0" for EUR, "2500" for XOF), not minor units.
      const amountStr = this.formatAmountForRequest(apiAmount, apiCurrency);
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
          amount: amountStr,
          currency: apiCurrency,
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

  async handleWebhook(payload: string, signature?: string): Promise<{ success: boolean; invoiceId?: string; businessId?: string; planToken?: string; storefrontToken?: string }> {
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
      const externalId = body.externalId ?? '';

      // Plan payment: qb-plan-<token>-<timestamp>
      if (externalId.startsWith('qb-plan-')) {
        const rest = externalId.slice(8);
        const lastDash = rest.lastIndexOf('-');
        const maybeTs = rest.slice(lastDash + 1);
        const planToken = /^\d+$/.test(maybeTs) ? rest.slice(0, lastDash) : rest;
        return { success, planToken: planToken || undefined };
      }

      // Storefront payment: qb-storefront-<token>-<timestamp>
      if (externalId.startsWith('qb-storefront-')) {
        const rest = externalId.slice(14);
        const lastDash = rest.lastIndexOf('-');
        const maybeTs = rest.slice(lastDash + 1);
        const storefrontToken = /^\d+$/.test(maybeTs) ? rest.slice(0, lastDash) : rest;
        return { success, storefrontToken: storefrontToken || undefined };
      }

      // Invoice payment: qb-<businessId>-<invoiceId>-<timestamp>
      let invoiceId: string | undefined;
      let businessId: string | undefined;
      if (externalId.startsWith('qb-')) {
        const withoutPrefix = externalId.slice(3);
        const withoutTimestamp = withoutPrefix.replace(/-\d+$/, '');
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

  /**
   * Disburse (transfer) money to a mobile money number.
   * Uses MOMO_DISBURSEMENT_API_USER, MOMO_DISBURSEMENT_API_KEY, MOMO_DISBURSEMENT_SUBSCRIPTION_KEY.
   * Falls back to ledger-only when disbursement credentials are not configured.
   */
  async disburse(phone: string, amount: number, currency: string, externalId: string): Promise<{ transactionId: string; success?: boolean; error?: string }> {
    const apiUser = process.env['MOMO_DISBURSEMENT_API_USER'];
    const apiKey = process.env['MOMO_DISBURSEMENT_API_KEY'];
    const subKey = process.env['MOMO_DISBURSEMENT_SUBSCRIPTION_KEY'];

    if (!apiUser?.trim() || !apiKey?.trim() || !subKey?.trim()) {
      console.warn(`MoMo disbursement not configured. Transaction recorded in ledger only. phone=${phone} amount=${amount} ${currency}`);
      return { transactionId: `pending-${externalId}` };
    }

    try {
      const token = await this.getDisbursementToken(apiUser, apiKey, subKey);
      if (!token) {
        return { transactionId: `pending-${externalId}`, success: false, error: 'Failed to obtain MoMo disbursement token' };
      }

      const referenceId = crypto.randomUUID();
      const formattedAmount = this.formatAmount(amount, currency);
      const url = `${this.baseUrl}/disbursement/v1_0/transfer`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': subKey,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': process.env['MOMO_TARGET_ENV'] || 'sandbox',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: String(formattedAmount),
          currency,
          externalId,
          payee: { partyIdType: 'MSISDN', partyId: toMsisdn(phone) },
          payerMessage: 'Supplier payment',
          payeeNote: `Payment ref ${externalId}`,
        }),
      });

      if (res.status === 202 || res.status === 200) {
        return { transactionId: referenceId, success: true };
      }

      const text = await res.text();
      let errMsg: string;
      try {
        errMsg = (JSON.parse(text) as { message?: string }).message ?? text ?? `MoMo disbursement ${res.status}`;
      } catch {
        errMsg = text || `MoMo disbursement ${res.status}`;
      }
      return { transactionId: referenceId, success: false, error: errMsg };
    } catch (err) {
      return {
        transactionId: `pending-${externalId}`,
        success: false,
        error: (err as Error).message,
      };
    }
  }

  private async getDisbursementToken(apiUser: string, apiKey: string, subscriptionKey: string): Promise<string | null> {
    const url = `${this.baseUrl}/disbursement/token/`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          Authorization: `Basic ${Buffer.from(`${apiUser}:${apiKey}`).toString('base64')}`,
        },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { access_token?: string };
      return data.access_token ?? null;
    } catch {
      return null;
    }
  }

  /** MTN Collection API expects amount in major units as string (e.g. "5.0" EUR, "2500" XOF). */
  private formatAmountForRequest(amount: number, currency: string): string {
    const noCents = ['XOF', 'XAF', 'GNF', 'XPF'];
    if (noCents.includes(currency.toUpperCase())) {
      return String(Math.round(amount));
    }
    return String(Math.round(amount * 100) / 100);
  }

  private formatAmount(amount: number, currency: string): number {
    const noCents = ['XOF', 'XAF', 'GNF', 'XPF'];
    return noCents.includes(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
  }
}
