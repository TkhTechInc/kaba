import { IPaymentGateway, PaymentGatewayType } from '../interfaces/IPaymentGateway';
import {
  CreatePaymentIntentRequest,
  PaymentGatewayResponse,
} from '../models/Payment';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mock payment gateway for development and testing.
 * Returns a fake payment URL.
 */
export class MockPaymentGateway implements IPaymentGateway {
  readonly gatewayType: PaymentGatewayType = 'mock';

  private readonly supportedCurrencies = ['NGN', 'XOF', 'XAF', 'GHS', 'USD', 'EUR'];

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentGatewayResponse> {
    const transactionId = `mock_${uuidv4()}`;
    const paymentUrl = `https://mock-payment.example.com/pay/${transactionId}?invoiceId=${request.invoiceId}&amount=${request.amount}&currency=${request.currency}`;

    return {
      success: true,
      gatewayTransactionId: transactionId,
      gatewayResponse: { transactionId, paymentUrl },
      paymentUrl,
    };
  }

  isCurrencySupported(currency: string): boolean {
    return this.supportedCurrencies.includes(currency.toUpperCase());
  }

  getSupportedCurrencies(): string[] {
    return [...this.supportedCurrencies];
  }

  async handleWebhook(_payload: string, _signature?: string): Promise<{ success: boolean; invoiceId?: string }> {
    return { success: true };
  }
}
