import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IFNEProvider, FNERegistrationResult } from '../interfaces/IFNEProvider';

/**
 * Real FNE adapter for Côte d'Ivoire DGI.
 * Calls the FNE API at services.fne.dgi.gouv.ci when FNE_CI_API_KEY is configured.
 *
 * FNE uses a pre-clearance model: submit invoice → DGI validates → returns QR + fiscal serial.
 * API schema may evolve; update when official DGI documentation is available.
 *
 * Use StubFNEProvider when FNE_CI_API_KEY is not set.
 */
@Injectable()
export class CoteDIvoireFneAdapter implements IFNEProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('fiscal.fneCiBaseUrl') ?? 'https://services.fne.dgi.gouv.ci';
    this.apiKey = this.config.get<string>('fiscal.fneCiApiKey') ?? '';
  }

  getSupportedCountries(): string[] {
    return ['CI'];
  }

  async registerInvoice(
    countryCode: string,
    invoiceData: {
      businessId: string;
      invoiceId: string;
      amount: number;
      currency: string;
      customerId?: string;
      items?: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
    }
  ): Promise<FNERegistrationResult | null> {
    if (countryCode !== 'CI') {
      return null;
    }

    if (!this.apiKey) {
      return null;
    }

    const url = `${this.baseUrl}/api/invoices`;
    const body = this.mapToFnePayload(invoiceData);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': this.apiKey,
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`FNE registerInvoice failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.mapFromFneResponse(data, invoiceData.invoiceId);
  }

  private mapToFnePayload(invoiceData: {
    businessId: string;
    invoiceId: string;
    amount: number;
    currency: string;
    customerId?: string;
    items?: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
  }): Record<string, unknown> {
    return {
      businessId: invoiceData.businessId,
      invoiceId: invoiceData.invoiceId,
      amount: invoiceData.amount,
      currency: invoiceData.currency,
      customerId: invoiceData.customerId,
      items: invoiceData.items,
    };
  }

  private mapFromFneResponse(data: Record<string, unknown>, invoiceId: string): FNERegistrationResult {
    const serialNumber =
      (data.serialNumber as string) ??
      (data.fiscalNumber as string) ??
      (data.nim as string) ??
      `FNE-CI-${invoiceId.slice(0, 8)}`;
    const qrCodeData = (data.qrCode as string) ?? (data.qrCodeData as string) ?? undefined;
    const certifiedAt =
      (data.certifiedAt as string) ?? (data.certified_at as string) ?? new Date().toISOString();

    return {
      serialNumber,
      qrCodeData,
      certifiedAt,
    };
  }
}
