/**
 * HTTP client for the TKH Payments microservice.
 * All payment operations from Kaba go through TKH Payments (payment gateway aggregator).
 *
 * Features:
 * - Circuit breaker pattern to fail fast when TKH Payments is down
 * - Automatic retry with exponential backoff for transient failures
 * - Comprehensive error handling with specific error types
 *
 * Requires PAYMENTS_SERVICE_URL. No local gateway fallback.
 *
 * TKH Payments API contract (implement in payments service):
 * - POST /intents - create payment intent
 * - GET /config?currency=XOF&country=BJ - payment options (useKkiaPayWidget, useMomoRequest)
 * - POST /intents/request-momo - MoMo/Moov request-to-pay
 * - POST /intents/verify-kkiapay - verify KkiaPay transaction
 * - POST /disbursements - disburse to mobile money
 */
import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import pRetry from 'p-retry';
import { ExternalServiceError, ConfigurationError, BusinessRuleError } from '@/shared/errors/DomainError';

export interface PaymentsIntentResponse {
  id: string;
  status: string;
  paymentUrl?: string;
  clientSecret?: string;
  gateway: string;
}

export interface PayConfigResponse {
  useKkiaPayWidget: boolean;
  useMomoRequest: boolean;
}

@Injectable()
export class PaymentsClient {
  private readonly logger = new Logger(PaymentsClient.name);
  private readonly serviceUrl: string;
  private readonly apiKey: string | undefined;
  private readonly breaker: CircuitBreaker;

  constructor() {
    const url = process.env['PAYMENTS_SERVICE_URL']?.replace(/\/$/, '');
    if (!url?.trim()) {
      throw new Error(
        'PAYMENTS_SERVICE_URL is required. All payments must go through TKH Payments. ' +
          'Set PAYMENTS_SERVICE_URL to the TKH Payments microservice base URL.',
      );
    }
    this.serviceUrl = url;
    this.apiKey = process.env['TKH_PAYMENTS_API_KEY'];

    // Circuit breaker configuration
    this.breaker = new CircuitBreaker(this.fetchWithRetry.bind(this), {
      timeout: 15000,                  // 15s timeout per request
      errorThresholdPercentage: 50,    // Open circuit if 50% of requests fail
      resetTimeout: 30000,             // Try again after 30s
      rollingCountTimeout: 60000,      // 1-minute rolling window
      rollingCountBuckets: 10,
      name: 'TkhPaymentsClient',
    });

    // Circuit breaker event listeners for monitoring
    this.breaker.on('open', () => {
      this.logger.error('[Circuit Breaker] OPEN - TKH Payments circuit opened due to failures');
    });

    this.breaker.on('halfOpen', () => {
      this.logger.warn('[Circuit Breaker] HALF-OPEN - Testing if TKH Payments recovered');
    });

    this.breaker.on('close', () => {
      this.logger.log('[Circuit Breaker] CLOSED - TKH Payments circuit closed, operating normally');
    });

    this.breaker.on('reject', () => {
      this.logger.warn('[Circuit Breaker] REJECT - Request rejected, circuit is OPEN');
    });
  }

  private getMoMoSandboxOverride(): { currency?: string; countryCode?: string } {
    const currency = process.env['MOMO_TEST_CURRENCY']?.trim().toUpperCase();
    const countryCode = process.env['MOMO_TEST_COUNTRY']?.trim().toUpperCase();
    return {
      ...(currency ? { currency } : {}),
      ...(countryCode ? { countryCode } : {}),
    };
  }

  private shouldForceMoMoUi(): boolean {
    const explicit = process.env['MOMO_TEST_FORCE_MOMO_UI'];
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    if (process.env['MOMO_TEST_FORCE_GH'] === 'true') return true;
    const override = this.getMoMoSandboxOverride();
    return !!override.currency || !!override.countryCode;
  }

  private shouldForceKkiaPayUi(): boolean {
    const explicit = process.env['KKIAPAY_TEST_FORCE_UI'];
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    return false;
  }

  private getKkiaPayTestPhoneNumber(): string | undefined {
    const phone = process.env['KKIAPAY_TEST_PHONE_NUMBER']?.trim();
    if (!phone) return undefined;
    return phone;
  }

  /**
   * Local fallback when TKH Payments does not expose /config.
   * This keeps checkout usable instead of failing with 500.
   */
  private derivePayConfigFallback(currency: string, countryCode?: string): PayConfigResponse {
    const cur = currency.toUpperCase().trim();
    const cc = countryCode?.toUpperCase().trim();
    const forceMoMoUi = this.shouldForceMoMoUi();
    const forceKkiaPayUi = this.shouldForceKkiaPayUi();

    const kkiapayCountries = new Set([
      'BJ', 'TG', 'CI', 'SN', 'ML', 'NE', 'BF', 'CM', 'GA', 'CG', 'TD', 'GN',
    ]);
    const kkiapayCurrencies = new Set(['XOF', 'XAF', 'GNF']);
    // Conservative fallback: only advertise MoMo request where it is known-stable.
    // This avoids surfacing MoMo UI that then fails with "Currency not supported."
    const momoCurrencies = new Set(['GHS']);
    const momoCountries = new Set(['GH']);

    if (forceMoMoUi) {
      return {
        useKkiaPayWidget:
          forceKkiaPayUi ||
          (kkiapayCurrencies.has(cur) && (!!cc ? kkiapayCountries.has(cc) : true)),
        useMomoRequest: true,
      };
    }

    return {
      useKkiaPayWidget:
        forceKkiaPayUi ||
        (kkiapayCurrencies.has(cur) && (!!cc ? kkiapayCountries.has(cc) : true)),
      useMomoRequest: momoCurrencies.has(cur) && (!!cc ? momoCountries.has(cc) : false),
    };
  }

  /**
   * Optional sandbox override for MoMo testing.
   * Use MOMO_TEST_CURRENCY and MOMO_TEST_COUNTRY for explicit test lanes.
   * MOMO_TEST_FORCE_GH=true remains supported for legacy GH/GHS forcing.
   */
  private getMoMoTestParams(params: {
    amount: number;
    currency: string;
    countryCode?: string;
  }): { amount: number; currency: string; countryCode?: string } {
    if (process.env['MOMO_TEST_FORCE_GH'] === 'true') {
      if (params.currency.toUpperCase() !== 'GHS' || params.countryCode?.toUpperCase() !== 'GH') {
        this.logger.warn(
          `MoMo test override active: forcing GH/GHS for sandbox testing (was ${params.countryCode ?? 'n/a'}/${params.currency}).`,
        );
      }
      return {
        ...params,
        currency: 'GHS',
        countryCode: 'GH',
      };
    }

    const override = this.getMoMoSandboxOverride();
    if (!override.currency && !override.countryCode) return params;

    const targetCurrency = override.currency ?? params.currency.toUpperCase();
    const targetCountry = override.countryCode ?? params.countryCode;
    if (
      targetCurrency !== params.currency.toUpperCase() ||
      (targetCountry?.toUpperCase() ?? '') !== (params.countryCode?.toUpperCase() ?? '')
    ) {
      this.logger.warn(
        `MoMo test override active: forcing ${targetCountry ?? 'n/a'}/${targetCurrency} (was ${params.countryCode ?? 'n/a'}/${params.currency}).`,
      );
    }
    return {
      ...params,
      currency: targetCurrency,
      countryCode: targetCountry,
    };
  }

  /**
   * Optional dev-only mock success when upstream MoMo is unavailable.
   * Enabled by default in development; disable with MOMO_TEST_MOCK_SUCCESS=false.
   */
  private shouldMockMoMoSuccess(): boolean {
    const explicit = process.env['MOMO_TEST_MOCK_SUCCESS'];
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    const env = process.env['NODE_ENV'];
    return env !== 'production';
  }

  /**
   * Fetch with circuit breaker and retry logic
   */
  private async fetch<T>(
    path: string,
    options: { method?: string; body?: object } = {},
  ): Promise<T> {
    try {
      return await this.breaker.fire(path, options);
    } catch (error) {
      // Classify error for better handling
      if (error instanceof Error) {
        if (error.message.includes('Invalid API key') || error.message.includes('Unauthorized')) {
          throw new ConfigurationError('TKH Payments API key is invalid or missing');
        }
        if (error.message.includes('Insufficient funds')) {
          throw new BusinessRuleError('Customer has insufficient funds');
        }
        if (error.message.includes('Circuit breaker is open')) {
          throw new ExternalServiceError('TKH Payments is currently unavailable. Please try again later.');
        }
      }
      throw new ExternalServiceError(`Payment request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Underlying fetch with retry logic
   */
  private async fetchWithRetry<T>(
    path: string,
    options: { method?: string; body?: object } = {},
  ): Promise<T> {
    return pRetry(
      async () => {
        const { method = 'GET', body } = options;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['X-API-Key'] = this.apiKey;

        const res = await fetch(`${this.serviceUrl}${path}`, {
          method,
          headers,
          ...(body && { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(15000),
        });

        const data = (await res.json().catch(() => ({}))) as T & { message?: string };

        if (!res.ok) {
          const errorMessage = (data as { message?: string }).message ?? `HTTP ${res.status}`;
          this.logger.error(`TKH Payments error ${res.status}: ${errorMessage}`);

          // Don't retry client errors (4xx) except 429 (rate limit)
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            throw new pRetry.AbortError(errorMessage);
          }

          throw new Error(errorMessage);
        }

        return data;
      },
      {
        retries: 3,
        minTimeout: 1000,    // 1s
        maxTimeout: 5000,    // 5s
        factor: 2,           // Exponential backoff
        onFailedAttempt: (error) => {
          this.logger.warn(
            `TKH Payments request attempt ${error.attemptNumber} failed: ${error.message}. ` +
            `${error.retriesLeft} retries left.`,
          );
        },
      },
    );
  }

  /**
   * Create a payment intent. All payment initiation goes through TKH Payments.
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
    gatewayOverride?: string;
    /** Use KkiaPay JS widget (Mode B) instead of REST push. Required for widget flow. */
    useWidget?: boolean;
  }): Promise<{
    paymentUrl?: string;
    clientSecret?: string;
    intentId?: string;
    success: boolean;
    error?: string;
    gatewayTransactionId?: string;
  }> {
    try {
      const metadata = { ...request.metadata };
      if (!metadata.phoneNumber) {
        const testPhone = this.getKkiaPayTestPhoneNumber();
        if (testPhone) {
          metadata.phoneNumber = testPhone;
          this.logger.warn(
            'KkiaPay test phone fallback applied (metadata.phoneNumber was missing).',
          );
        }
      }

      const body = {
        amount: request.amount,
        currency: request.currency,
        country: request.country ?? 'DEFAULT',
        metadata,
        returnUrl: request.returnUrl,
        gatewayOverride: request.gatewayOverride,
        useWidget: request.useWidget,
      };

      const data = (await this.fetch(
        '/intents',
        { method: 'POST', body },
      )) as {
        id?: string;
        status?: string;
        paymentUrl?: string;
        clientSecret?: string;
        message?: string;
      };

      this.logger.log(`Intent created via TKH Payments: ${data.id}`);
      return {
        success: true,
        intentId: data.id,
        paymentUrl: data.paymentUrl,
        clientSecret: data.clientSecret,
      };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Payments service: ${msg}`);
      return { success: false, error: msg };
    }
  }

  /**
   * Get payment options for a currency/country (KkiaPay widget, MoMo request-to-pay).
   */
  async getPayConfig(currency: string, countryCode?: string): Promise<PayConfigResponse> {
    const normalizedCurrency = currency.toUpperCase();
    const params = new URLSearchParams({ currency: normalizedCurrency });
    if (countryCode?.trim()) params.set('country', countryCode.toUpperCase().trim());
    try {
      const data = (await this.fetch(`/config?${params}`)) as PayConfigResponse;
      const forceKkiaPayUi = this.shouldForceKkiaPayUi();
      const forceMoMoUi = this.shouldForceMoMoUi();
      return {
        useKkiaPayWidget: forceKkiaPayUi || (data?.useKkiaPayWidget ?? false),
        useMomoRequest: forceMoMoUi || (data?.useMomoRequest ?? false),
      };
    } catch (err) {
      const fallback = this.derivePayConfigFallback(normalizedCurrency, countryCode);
      this.logger.warn(
        `TKH Payments /config unavailable, using local pay-config fallback for ${normalizedCurrency}${countryCode ? `/${countryCode}` : ''}: ${(err as Error).message}`,
      );
      return fallback;
    }
  }

  /**
   * Request MoMo/Moov payment (request-to-pay). Sends push to customer's phone.
   */
  async requestMoMoPayment(params: {
    amount: number;
    currency: string;
    phone: string;
    countryCode?: string;
    metadata: Record<string, string>;
  }): Promise<{ success: boolean; error?: string }> {
    const momoParams = this.getMoMoTestParams(params);
    try {
      const data = (await this.fetch('/intents/request-momo', {
        method: 'POST',
        body: {
          amount: momoParams.amount,
          currency: momoParams.currency,
          phone: params.phone,
          countryCode: momoParams.countryCode,
          metadata: params.metadata,
        },
      })) as { success?: boolean; error?: string };

      return {
        success: data?.success !== false,
        error: data?.error,
      };
    } catch (err) {
      // Fallback for older/newer TKH Payments contracts that do not expose /intents/request-momo.
      // In that case, create a standard intent and force MoMo gateway with phoneNumber metadata.
      try {
        const fallback = await this.createIntent({
          amount: momoParams.amount,
          currency: momoParams.currency,
          country: momoParams.countryCode,
          gatewayOverride: 'momo',
          metadata: {
            appId: params.metadata['appId'] ?? 'kaba',
            referenceId:
              params.metadata['referenceId'] ??
              params.metadata['invoiceId'] ??
              params.metadata['paymentIntentId'] ??
              `momo-${Date.now()}`,
            phoneNumber: params.phone,
            ...params.metadata,
          },
        });
        if (fallback.success) {
          return { success: true };
        }
        if (this.shouldMockMoMoSuccess()) {
          this.logger.warn(
            `MoMo dev mock success enabled after upstream failure: ${fallback.error ?? 'unknown error'}`,
          );
          return { success: true };
        }
        return { success: false, error: fallback.error };
      } catch (fallbackErr) {
        if (this.shouldMockMoMoSuccess()) {
          this.logger.warn(
            `MoMo dev mock success enabled after fallback exception: ${(fallbackErr as Error).message}`,
          );
          return { success: true };
        }
        return { success: false, error: (fallbackErr as Error).message };
      }
    }
  }

  /**
   * Verify KkiaPay transaction (widget flow).
   */
  async verifyKkiaPayTransaction(transactionId: string, intentId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const data = (await this.fetch('/intents/verify-kkiapay', {
        method: 'POST',
        body: { transactionId, intentId },
      })) as { success?: boolean; verified?: boolean; error?: string; message?: string };

      return {
        success: data?.verified === true || data?.success === true,
        error: data?.error ?? data?.message,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Disburse to mobile money (e.g. supplier payout).
   */
  async disburse(params: {
    phone: string;
    amount: number;
    currency: string;
    externalId: string;
  }): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const data = (await this.fetch('/disbursements', {
        method: 'POST',
        body: params,
      })) as { success?: boolean; transactionId?: string; error?: string };

      return {
        success: data?.success !== false,
        transactionId: data?.transactionId,
        error: data?.error,
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  }
}
