import type {
  ITaxEngine,
  TaxableTransaction,
  TaxSummary,
} from './ITaxEngine';

/**
 * Nigeria tax engine (FIRS).
 * VAT rate: 7.5% (as of Finance Act 2020).
 */
export class NigeriaTaxEngine implements ITaxEngine {
  private readonly VAT_RATE = 0.075;

  async calculateVAT(
    transactions: TaxableTransaction[],
    _countryCode: string,
    period: { start: string; end: string },
  ): Promise<TaxSummary> {
    let totalSales = 0;
    let totalPurchases = 0;
    let vatOnSales = 0;
    let vatOnPurchases = 0;

    for (const t of transactions) {
      const rate = t.taxRate ?? this.VAT_RATE;
      if (t.type === 'sale') {
        totalSales += t.amount;
        const base = t.isTaxInclusive ? t.amount / (1 + rate) : t.amount;
        vatOnSales += t.isTaxInclusive ? t.amount - base : base * rate;
      } else if (t.type === 'purchase' || t.type === 'expense') {
        totalPurchases += t.amount;
        const base = t.isTaxInclusive ? t.amount / (1 + rate) : t.amount;
        vatOnPurchases += t.isTaxInclusive ? t.amount - base : base * rate;
      }
    }

    vatOnSales = Math.round(vatOnSales * 100) / 100;
    vatOnPurchases = Math.round(vatOnPurchases * 100) / 100;
    totalSales = Math.round(totalSales * 100) / 100;
    totalPurchases = Math.round(totalPurchases * 100) / 100;
    const netVAT = Math.round((vatOnSales - vatOnPurchases) * 100) / 100;
    const currency = transactions[0]?.currency ?? 'NGN';

    return {
      totalVAT: Math.round(netVAT * 100) / 100,
      totalSales,
      totalPurchases,
      currency,
      period,
      breakdown: [
        { rate: this.VAT_RATE * 100, amount: vatOnSales, base: totalSales },
        { rate: this.VAT_RATE * 100, amount: -vatOnPurchases, base: totalPurchases },
      ],
    };
  }

  getSupportedCountries(): string[] {
    return ['NG'];
  }
}
