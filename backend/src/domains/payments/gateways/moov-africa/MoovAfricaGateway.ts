/**
 * Moov Africa Mobile Money Gateway — Benin, Togo, Niger, etc.
 * Uses merchant SOAP API. Push-with-pending flow: backend initiates → user confirms via USSD.
 * Status via polling getTransactionStatus (no webhook).
 *
 * Requires: MOOV_AFRICA_USERNAME, MOOV_AFRICA_PASSWORD (from Moov Africa merchant signup)
 * Optional: MOOV_AFRICA_BASE_URL, MOOV_AFRICA_ENCRYPTION_KEY, MOOV_AFRICA_SANDBOX
 *
 * @see https://github.com/v1p3r75/moov-money-api-php-sdk
 * @see backend/docs/MOOV_AFRICA.md
 */

import * as crypto from 'crypto';
import type { IPaymentGateway, PaymentGatewayType } from '../../interfaces/IPaymentGateway';
import type { CreatePaymentIntentRequest, PaymentGatewayResponse } from '../../models/Payment';
import { MoovAfricaClient } from './MoovAfricaClient';

function toMsisdn(phone: string): string {
  return phone.replace(/\D/g, '');
}

export class MoovAfricaGateway implements IPaymentGateway {
  readonly gatewayType: PaymentGatewayType = 'moov_africa';

  private readonly client: MoovAfricaClient;

  private readonly supportedCurrencies = ['XOF'];

  constructor(username: string, password: string, baseUrl?: string, encryptionKey?: string, useSandbox?: boolean) {
    this.client = new MoovAfricaClient({
      username,
      password,
      baseUrl,
      encryptionKey,
      useSandbox: useSandbox ?? true,
    });
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentGatewayResponse> {
    try {
      const phoneNumber = request.metadata?.['phoneNumber'];
      if (!phoneNumber) {
        return {
          success: false,
          gatewayTransactionId: '',
          gatewayResponse: null,
          error: 'phoneNumber is required in metadata for Moov Africa',
        };
      }

      const amount = this.formatAmount(request.amount, request.currency);
      const externalId =
        request.metadata?.['paymentIntentId'] ||
        `qb-${request.businessId}-${request.invoiceId}-${Date.now()}`;

      const response = await this.client.pushWithPendingTransaction(
        toMsisdn(phoneNumber),
        amount,
        'Invoice payment',
        externalId,
        `Invoice ${request.invoiceId}`,
        0,
      );

      if (response.isSuccess) {
        return {
          success: true,
          gatewayTransactionId: response.referenceId ?? crypto.randomUUID(),
          gatewayResponse: {
            referenceId: response.referenceId,
            status: 'pending',
            externalId,
          },
        };
      }

      if (response.isPending) {
        return {
          success: true,
          gatewayTransactionId: response.referenceId ?? crypto.randomUUID(),
          gatewayResponse: {
            referenceId: response.referenceId,
            status: 'pending',
            externalId,
          },
        };
      }

      return {
        success: false,
        gatewayTransactionId: '',
        gatewayResponse: null,
        error: response.description ?? `Moov Africa status ${response.statusCode}`,
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

  /**
   * Moov Africa uses polling, not webhooks. This is a no-op.
   * Use getPaymentStatus for status checks.
   */
  async handleWebhook(): Promise<{ success: boolean }> {
    return { success: false };
  }

  /**
   * Poll transaction status. Use for invoice payment flow.
   */
  async getPaymentStatus(referenceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.client.getTransactionStatus(referenceId);
      return {
        success: response.isSuccess,
        error: response.isSuccess ? undefined : response.description,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Disburse (transfer) to mobile money via transferFlooz.
   */
  async disburse(
    phone: string,
    amount: number,
    currency: string,
    externalId: string,
  ): Promise<{ transactionId: string; success?: boolean; error?: string }> {
    try {
      const formattedAmount = this.formatAmount(amount, currency);
      const response = await this.client.transferFlooz(
        toMsisdn(phone),
        formattedAmount,
        externalId,
        '0',
        'Supplier payment',
      );

      const txId = response.referenceId ?? `pending-${externalId}`;
      return {
        transactionId: txId,
        success: response.isSuccess,
        error: response.isSuccess ? undefined : response.description,
      };
    } catch (err) {
      return {
        transactionId: `pending-${externalId}`,
        success: false,
        error: (err as Error).message,
      };
    }
  }

  private formatAmount(amount: number, currency: string): number {
    const noCents = ['XOF', 'XAF', 'GNF', 'XPF'];
    return noCents.includes(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
  }
}
