/**
 * Mock tax engine for development.
 * Returns stub tax summary without real calculations.
 */

import type {
  ITaxEngine,
  TaxableTransaction,
  TaxSummary,
} from './ITaxEngine';

export class MockTaxEngine implements ITaxEngine {
  private readonly supportedCountries = ['NG', 'BJ', 'GH', 'SN'];

  async calculateVAT(
    transactions: TaxableTransaction[],
    _countryCode: string,
    period: { start: string; end: string },
  ): Promise<TaxSummary> {
    const totalSales = transactions
      .filter((t) => t.type === 'sale')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalPurchases = transactions
      .filter((t) => t.type === 'purchase' || t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const currency = transactions[0]?.currency ?? 'NGN';

    return {
      totalVAT: 0,
      totalSales,
      totalPurchases,
      currency,
      period,
      breakdown: [],
    };
  }

  getSupportedCountries(): string[] {
    return [...this.supportedCountries];
  }
}
