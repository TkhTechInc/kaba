/**
 * Tax engine interface — no SDK imports.
 * Implementations (e.g. NigeriaTaxEngine) live in separate files.
 */

export interface TaxableTransaction {
  id: string;
  amount: number;
  currency: string;
  type: 'sale' | 'purchase' | 'expense';
  isTaxInclusive?: boolean;
  taxRate?: number;
}

export interface TaxSummary {
  totalVAT: number;
  totalSales: number;
  totalPurchases: number;
  currency: string;
  period: { start: string; end: string };
  breakdown?: Array<{ rate: number; amount: number; base: number }>;
}

export interface ITaxEngine {
  /**
   * Calculate VAT for transactions in a given country and period.
   */
  calculateVAT(
    transactions: TaxableTransaction[],
    countryCode: string,
    period: { start: string; end: string },
  ): Promise<TaxSummary>;

  /**
   * List country codes supported by this engine (e.g. NG, BJ, GH).
   */
  getSupportedCountries(): string[];
}
