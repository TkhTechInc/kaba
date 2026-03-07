/**
 * HTTP client for the TKH Payments microservice.
 * Replaces direct PaymentGatewayManager calls in InvoiceService.
 *
 * When PAYMENTS_SERVICE_URL is set, delegates to the standalone payments service.
 * Falls back to the local PaymentGatewayManager when running locally without the env var.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PaymentGatewayManager } from '../gateways/PaymentGatewayManager';
import type { CreatePaymentIntentRequest, PaymentGatewayResponse } from '../models/Payment';

export interface PaymentsIntentResponse {
  id: string;
  status: string;
  paymentUrl?: string;
  clientSecret?: string;
  gateway: string;
}

@Injectable()
export class PaymentsClient {
  private readonly logger = new Logger(PaymentsClient.name);
  private readonly serviceUrl: string | undefined;

  constructor(private readonly localGatewayManager: PaymentGatewayManager) {
    this.serviceUrl = process.env['PAYMENTS_SERVICE_URL']?.replace(/\/$/, '');
  }

  /**
   * Create a payment intent.
   * Uses the remote payments service if PAYMENTS_SERVICE_URL is configured,
   * falls back to local PaymentGatewayManager otherwise.
   */
  async createIntent(request: {
    amount: number;
    currency: string;
    country?: string;
    metadata: {
      appId: string;
      referenceId: string;
      customerId?: string;
      customerEmail?: string;
      phoneNumber?: string;
      businessId?: string;
      [key: string]: string | undefined;
    };
    returnUrl?: string;
  }): Promise<{ paymentUrl?: string; clientSecret?: string; intentId?: string; success: boolean; error?: string; gatewayTransactionId?: string }> {
    if (this.serviceUrl) {
      return this.callRemote(request);
    }
    return this.callLocal(request);
  }

  private async callRemote(request: {
    amount: number;
    currency: string;
    country?: string;
    metadata: Record<string, string | undefined>;
    returnUrl?: string;
  }): Promise<{ paymentUrl?: string; clientSecret?: string; intentId?: string; success: boolean; error?: string; gatewayTransactionId?: string }> {
    try {
      const body = {
        amount: request.amount,
        currency: request.currency,
        country: request.country ?? 'DEFAULT',
        metadata: request.metadata,
        returnUrl: request.returnUrl,
      };

      const res = await fetch(`${this.serviceUrl}/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        status?: string;
        paymentUrl?: string;
        clientSecret?: string;
        message?: string;
      };

      if (!res.ok) {
        this.logger.error(`Payments service error ${res.status}: ${data.message ?? 'unknown'}`);
        return { success: false, error: data.message ?? `Payments service error ${res.status}` };
      }

      this.logger.log(`Intent created via payments service: ${data.id}`);
      return {
        success: true,
        intentId: data.id,
        paymentUrl: data.paymentUrl,
        clientSecret: data.clientSecret,
      };
    } catch (err) {
      this.logger.error(`Payments service unreachable: ${(err as Error).message}`);
      return { success: false, error: `Payments service unreachable: ${(err as Error).message}` };
    }
  }

  private async callLocal(request: {
    amount: number;
    currency: string;
    country?: string;
    metadata: Record<string, string | undefined>;
    returnUrl?: string;
  }): Promise<{ paymentUrl?: string; clientSecret?: string; intentId?: string; success: boolean; error?: string; gatewayTransactionId?: string }> {
    const invoiceId = request.metadata['referenceId'] ?? request.metadata['invoiceId'] ?? '';
    const businessId = request.metadata['businessId'] ?? '';

    const gatewayRequest: CreatePaymentIntentRequest = {
      businessId,
      invoiceId,
      amount: request.amount,
      currency: request.currency,
      countryCode: request.country,
      customerId: request.metadata['customerId'],
      metadata: Object.fromEntries(
        Object.entries(request.metadata).filter(([, v]) => v !== undefined)
      ) as Record<string, string>,
    };

    const response: PaymentGatewayResponse = await this.localGatewayManager.createPaymentIntent(gatewayRequest);

    return {
      success: response.success,
      paymentUrl: response.paymentUrl,
      gatewayTransactionId: response.gatewayTransactionId,
      error: response.error,
    };
  }
}
