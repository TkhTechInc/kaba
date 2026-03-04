import type { IPaymentGateway, PaymentGatewayType } from '../interfaces/IPaymentGateway';
import type { CreatePaymentIntentRequest, PaymentGatewayResponse } from '../models/Payment';
import { MockPaymentGateway } from './MockPaymentGateway';
import { KkiaPayGateway } from './KkiaPayGateway';
import { MomoGateway } from './MomoGateway';
import { StripeGateway } from './StripeGateway';

/**
 * Manages payment gateways and selects the appropriate one by currency.
 * Pattern copied from events project.
 */
export class PaymentGatewayManager {
  private gateways: Map<PaymentGatewayType, IPaymentGateway> = new Map();

  constructor() {
    this.initializeGateways();
  }

  private initializeGateways(): void {
    this.registerGateway(new MockPaymentGateway());

    const stripeKey = process.env['STRIPE_SECRET_KEY'];
    if (stripeKey?.trim()) {
      this.registerGateway(new StripeGateway(stripeKey, process.env['STRIPE_WEBHOOK_SECRET'] ?? ''));
    }

    const kkiapayKey = process.env['KKIAPAY_PRIVATE_KEY'] || process.env['KKIAPAY_API_KEY'];
    if (kkiapayKey?.trim()) {
      this.registerGateway(new KkiaPayGateway(kkiapayKey, process.env['KKIAPAY_WEBHOOK_SECRET'] ?? '', process.env['KKIAPAY_BASE_URL']));
    }

    const momoApiKey = process.env['MOMO_API_KEY'];
    const momoSubKey = process.env['MOMO_SUBSCRIPTION_KEY'];
    if (momoApiKey?.trim() && momoSubKey?.trim()) {
      this.registerGateway(new MomoGateway(momoApiKey, momoSubKey, process.env['MOMO_WEBHOOK_SECRET'] ?? '', process.env['MOMO_BASE_URL']));
    }
  }

  private registerGateway(gateway: IPaymentGateway): void {
    this.gateways.set(gateway.gatewayType, gateway);
  }

  /**
   * Select gateway by currency. Prefers real gateways over mock; prioritizes by currency region.
   */
  selectGateway(request: CreatePaymentIntentRequest): IPaymentGateway {
    const currency = request.currency.toUpperCase();
    const found = this.selectGatewayByCurrency(currency);
    if (!found) {
      throw new Error(`No payment gateway configured for currency: ${currency}. Set STRIPE_SECRET_KEY, KKIAPAY_PRIVATE_KEY, or MOMO_API_KEY + MOMO_SUBSCRIPTION_KEY.`);
    }
    return found;
  }

  private selectGatewayByCurrency(currency: string): IPaymentGateway | null {
    const preferred: PaymentGatewayType[] =
      ['XOF', 'XAF', 'GNF'].includes(currency)
        ? ['kkiapay', 'momo', 'mock']
        : ['GHS'].includes(currency)
        ? ['momo', 'kkiapay', 'mock']
        : ['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(currency)
        ? ['stripe', 'mock']
        : ['stripe', 'kkiapay', 'momo', 'mock'];

    for (const type of preferred) {
      const gw = this.gateways.get(type);
      if (gw?.isCurrencySupported(currency)) return gw;
    }
    for (const gw of this.gateways.values()) {
      if (gw.isCurrencySupported(currency)) return gw;
    }
    return null;
  }

  /**
   * Get gateway by type.
   */
  getGatewayById(gatewayType: PaymentGatewayType): IPaymentGateway {
    const gw = this.gateways.get(gatewayType);
    if (!gw) throw new Error(`Payment gateway not registered: ${gatewayType}`);
    return gw;
  }

  /**
   * Create payment intent using the gateway selected by currency.
   */
  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentGatewayResponse> {
    const gw = this.selectGateway(request);
    return gw.createPaymentIntent(request);
  }

  /** Get available gateway types. */
  getAvailableGateways(): PaymentGatewayType[] {
    return Array.from(this.gateways.keys());
  }

  /** Get all supported currencies across gateways. */
  getSupportedCurrencies(): string[] {
    const currencies = new Set<string>();
    for (const gw of this.gateways.values()) {
      gw.getSupportedCurrencies().forEach((c) => currencies.add(c));
    }
    return Array.from(currencies);
  }

  /** True if at least one real (non-mock) gateway is configured. */
  hasRealGateway(): boolean {
    return this.gateways.has('stripe') || this.gateways.has('kkiapay') || this.gateways.has('momo');
  }
}
