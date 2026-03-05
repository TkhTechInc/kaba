import { Injectable } from '@nestjs/common';
import type { IPaymentGateway, PaymentGatewayType } from '../interfaces/IPaymentGateway';
import type { CreatePaymentIntentRequest, PaymentGatewayResponse } from '../models/Payment';
import { MockPaymentGateway } from './MockPaymentGateway';
import { KkiaPayGateway } from './KkiaPayGateway';
import { MomoGateway } from './MomoGateway';
import { PaystackGateway } from './PaystackGateway';
import { StripeGateway } from './StripeGateway';

/**
 * Country → preferred gateway order per payment region.
 * Payment gateways are country-specific; currency is used only to validate support.
 */
const COUNTRY_GATEWAY_PRIORITY: Record<string, PaymentGatewayType[]> = {
  // Benin, Togo, Ivory Coast — KkiaPay primary (XOF)
  BJ: ['kkiapay', 'momo', 'stripe', 'mock'],
  TG: ['kkiapay', 'momo', 'stripe', 'mock'],
  CI: ['kkiapay', 'momo', 'stripe', 'mock'],
  // Senegal, Mali, Niger, Burkina Faso — XOF
  SN: ['kkiapay', 'momo', 'stripe', 'mock'],
  ML: ['kkiapay', 'momo', 'stripe', 'mock'],
  NE: ['kkiapay', 'momo', 'stripe', 'mock'],
  BF: ['kkiapay', 'momo', 'stripe', 'mock'],
  // Ghana — MoMo primary (GHS)
  GH: ['momo', 'kkiapay', 'stripe', 'mock'],
  // Nigeria — Paystack primary (NGN), then Stripe, MoMo
  NG: ['paystack', 'stripe', 'momo', 'mock'],
  // Cameroon, Gabon, etc. — XAF
  CM: ['kkiapay', 'momo', 'stripe', 'mock'],
  GA: ['kkiapay', 'momo', 'stripe', 'mock'],
  CG: ['kkiapay', 'momo', 'stripe', 'mock'],
  CF: ['kkiapay', 'momo', 'stripe', 'mock'],
  TD: ['kkiapay', 'momo', 'stripe', 'mock'],
  GQ: ['kkiapay', 'momo', 'stripe', 'mock'],
  // Guinea — GNF
  GN: ['kkiapay', 'momo', 'stripe', 'mock'],
  // International / fallback
  DEFAULT: ['stripe', 'kkiapay', 'momo', 'mock'],
};

@Injectable()
export class PaymentGatewayManager {
  private gateways: Map<PaymentGatewayType, IPaymentGateway> = new Map();

  constructor() {
    this.initializeGateways();
  }

  private initializeGateways(): void {
    const env = process.env['NODE_ENV'];
    if (env === 'development' || env === 'test' || env === 'local' || !env) {
      this.registerGateway(new MockPaymentGateway());
    }

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

    const paystackKey = process.env['PAYSTACK_SECRET_KEY'];
    if (paystackKey?.trim()) {
      this.registerGateway(new PaystackGateway(paystackKey, process.env['PAYSTACK_WEBHOOK_SECRET'] ?? ''));
    }
  }

  private registerGateway(gateway: IPaymentGateway): void {
    this.gateways.set(gateway.gatewayType, gateway);
  }

  /**
   * Select gateway by country first, then validate currency support.
   * Falls back to currency-based selection if countryCode is missing.
   */
  selectGateway(request: CreatePaymentIntentRequest): IPaymentGateway {
    const currency = request.currency.toUpperCase();
    const countryCode = request.countryCode?.toUpperCase().trim();

    const preferred = countryCode && COUNTRY_GATEWAY_PRIORITY[countryCode]
      ? COUNTRY_GATEWAY_PRIORITY[countryCode]
      : COUNTRY_GATEWAY_PRIORITY.DEFAULT;

    for (const type of preferred) {
      const gw = this.gateways.get(type);
      if (gw?.isCurrencySupported(currency)) return gw;
    }
    for (const gw of this.gateways.values()) {
      if (gw.isCurrencySupported(currency)) return gw;
    }

    throw new Error(
      `No payment gateway configured for country ${countryCode ?? 'unknown'} / currency ${currency}. ` +
      'Set STRIPE_SECRET_KEY, KKIAPAY_PRIVATE_KEY, or MOMO_API_KEY + MOMO_SUBSCRIPTION_KEY. Set business countryCode in onboarding.'
    );
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
   * Create payment intent using the gateway selected by country (and currency).
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
    return this.gateways.has('stripe') || this.gateways.has('kkiapay') || this.gateways.has('momo') || this.gateways.has('paystack');
  }
}
