import type { IFNEProvider, FNERegistrationResult } from '../interfaces/IFNEProvider';

/**
 * Stub FNE provider. Returns mock data until real government API integration.
 * Benin (BJ) and Ivory Coast (CI) are placeholders for future implementation.
 */
export class StubFNEProvider implements IFNEProvider {
  getSupportedCountries(): string[] {
    return ['BJ', 'CI'];
  }

  async registerInvoice(
    _countryCode: string,
    invoiceData: { businessId: string; invoiceId: string; amount: number; currency: string }
  ): Promise<FNERegistrationResult | null> {
    return {
      serialNumber: `FNE-STUB-${invoiceData.invoiceId.slice(0, 8)}`,
      qrCodeData: `https://fne-stub.example.com/verify/${invoiceData.invoiceId}`,
      certifiedAt: new Date().toISOString(),
    };
  }
}
