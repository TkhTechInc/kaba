/**
 * FNE (Facture Numérique Électronique) / Standardized Invoice provider.
 * Country-specific integration with government tax portals (e.g. Benin DGI, Ivory Coast FNE).
 * Requires external API agreement with tax authority or intermediary.
 */
export interface FNERegistrationResult {
  serialNumber: string;
  qrCodeData?: string;
  certifiedAt: string;
}

export interface IFNEProvider {
  /**
   * Register an invoice with the government portal and obtain certified serial/QR.
   * @param countryCode ISO 3166-1 alpha-2 (e.g. BJ, CI)
   * @param invoiceData Invoice details required for registration
   */
  registerInvoice(
    countryCode: string,
    invoiceData: {
      businessId: string;
      invoiceId: string;
      amount: number;
      currency: string;
      customerId?: string;
      items?: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
    }
  ): Promise<FNERegistrationResult | null>;

  getSupportedCountries(): string[];
}
