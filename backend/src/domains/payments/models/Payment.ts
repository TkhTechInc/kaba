/**
 * Payment domain types for Kaba.
 * Minimal types for IPaymentGateway interface.
 */

export interface CreatePaymentIntentRequest {
  businessId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  /** ISO 3166-1 alpha-2 country code (e.g. NG, GH, BJ). Used to select the right payment gateway per country. */
  countryCode?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface ConfirmPaymentRequest {
  paymentIntentId: string;
  paymentMethodId?: string;
  metadata?: Record<string, string>;
}

export interface PaymentGatewayResponse {
  success: boolean;
  gatewayTransactionId: string;
  gatewayResponse: unknown;
  /** For redirect flows: URL to send the user to complete payment. */
  paymentUrl?: string;
  error?: string;
}

export interface PaymentGatewayEvent {
  id: string;
  type: string;
  data: { object: unknown };
  [key: string]: unknown;
}
