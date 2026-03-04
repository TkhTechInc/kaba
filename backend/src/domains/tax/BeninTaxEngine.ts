import type {
  ITaxEngine,
  TaxableTransaction,
  TaxSummary,
} from './ITaxEngine';

/**
 * Benin tax engine (Loi de Finances Benin).
 * VAT rate: 18% (standard rate).
 */
export class BeninTaxEngine implements ITaxEngine {
  private readonly VAT_RATE = 0.18;

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

    const netVAT = vatOnSales - vatOnPurchases;
    const currency = transactions[0]?.currency ?? 'XOF';

    return {
      totalVAT: Math.max(0, netVAT),
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
    return ['BJ'];
  }
}
