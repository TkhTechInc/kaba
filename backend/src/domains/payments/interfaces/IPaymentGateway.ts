/**
 * Payment gateway interface for QuickBooks West Africa.
 * Implementations: MockPaymentGateway, StripeGateway, KkiaPayGateway, etc.
 */

import {
  CreatePaymentIntentRequest,
  PaymentGatewayResponse,
} from '../models/Payment';

export type PaymentGatewayType = 'mock' | 'stripe' | 'kkiapay' | 'momo';

export interface IPaymentGateway {
  readonly gatewayType: PaymentGatewayType;

  /** Create payment intent; returns response with paymentUrl for redirect flows. */
  createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentGatewayResponse>;

  /** Check if currency is supported. */
  isCurrencySupported(currency: string): boolean;

  /** Get list of supported currencies. */
  getSupportedCurrencies(): string[];

  /** Handle webhook from gateway (e.g. payment confirmation). Returns response for gateway. */
  handleWebhook?(payload: string, signature?: string): Promise<{
    success: boolean;
    invoiceId?: string;
    businessId?: string;
  }>;
}
