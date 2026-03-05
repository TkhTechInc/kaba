/**
 * Stripe payment gateway — USD, EUR, GBP and other international currencies.
 * Requires: STRIPE_SECRET_KEY
 * Optional: STRIPE_WEBHOOK_SECRET (for webhook signature verification)
 */

import Stripe from 'stripe';
import type { IPaymentGateway, PaymentGatewayType } from '../interfaces/IPaymentGateway';
import type { CreatePaymentIntentRequest, PaymentGatewayResponse } from '../models/Payment';

export class StripeGateway implements IPaymentGateway {
  readonly gatewayType: PaymentGatewayType = 'stripe';

  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NGN'];

  constructor(secretKey: string, webhookSecret = '') {
    this.stripe = new Stripe(secretKey);
    this.webhookSecret = webhookSecret;
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentGatewayResponse> {
    try {
      const intent = await this.stripe.paymentIntents.create({
        amount: Math.round(request.amount * 100),
        currency: request.currency.toLowerCase(),
        metadata: {
          invoiceId: request.invoiceId,
          businessId: request.businessId,
          ...request.metadata,
        },
        automatic_payment_methods: { enabled: true },
      });
      return {
        success: true,
        gatewayTransactionId: intent.id,
        gatewayResponse: intent,
        paymentUrl: undefined,
      };
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
    // In production, always require signature verification.
    if (this.webhookSecret) {
      if (!signature) return { success: false };
      try {
        const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
        const obj = event.data.object as { metadata?: { invoiceId?: string; businessId?: string } };
        if (event.type === 'payment_intent.succeeded') {
          return { success: true, invoiceId: obj.metadata?.invoiceId, businessId: obj.metadata?.businessId };
        }
        return { success: true };
      } catch {
        return { success: false };
      }
    }
    // No webhook secret configured — only parse body without verification (dev/mock only).
    try {
      const body = JSON.parse(payload) as { type?: string; data?: { object?: { metadata?: { invoiceId?: string; businessId?: string } } } };
      if (body.type === 'payment_intent.succeeded') {
        return { success: true, invoiceId: body.data?.object?.metadata?.invoiceId, businessId: body.data?.object?.metadata?.businessId };
      }
      return { success: true };
    } catch {
      return { success: false };
    }
  }
}
