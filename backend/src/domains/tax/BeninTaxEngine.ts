import type {
  ITaxEngine,
  TaxableTransaction,
  TaxSummary,
} from './ITaxEngine';

/**
 * Benin tax engine — Loi de Finances 2026 (updated).
 *
 * Standard VAT rate: 18% (unchanged from prior law).
 *
 * 2026 Finance Law exemptions (0% VAT):
 *  - construction_materials  — Building materials for SME construction projects
 *  - sme_imports             — SME imports up to XOF 10,000,000/month (amount cap)
 *  - agricultural_inputs     — Seeds, fertilizers, agricultural equipment
 *
 * 2026 deduction limit:
 *  - SME import deduction capped at XOF 10,000,000/month before VAT applies.
 *    Amounts above the cap are subject to the standard 18% rate.
 */
export class BeninTaxEngine implements ITaxEngine {
  private readonly VAT_RATE = 0.18;
  private readonly SME_IMPORT_MONTHLY_CAP = 10_000_000; // XOF

  private readonly EXEMPT_CATEGORIES = new Set([
    'construction_materials',
    'sme_imports',
    'agricultural_inputs',
  ]);

  /** Returns effective VAT rate for a transaction based on its category (2026 law). */
  private getEffectiveRate(transaction: TaxableTransaction, smeImportRunningTotal: number): {
    rate: number;
    taxableAmount: number;
  } {
    if (!transaction.category || !this.EXEMPT_CATEGORIES.has(transaction.category)) {
      return { rate: transaction.taxRate ?? this.VAT_RATE, taxableAmount: transaction.amount };
    }

    // Agricultural inputs and construction materials: fully exempt
    if (
      transaction.category === 'agricultural_inputs' ||
      transaction.category === 'construction_materials'
    ) {
      return { rate: 0, taxableAmount: 0 };
    }

    // SME imports: exempt up to XOF 10M/month cap, standard rate on the excess
    if (transaction.category === 'sme_imports') {
      const remaining = Math.max(0, this.SME_IMPORT_MONTHLY_CAP - smeImportRunningTotal);
      if (remaining <= 0) {
        // Cap already exhausted — full standard rate
        return { rate: this.VAT_RATE, taxableAmount: transaction.amount };
      }
      const exemptPortion = Math.min(transaction.amount, remaining);
      const taxablePortion = transaction.amount - exemptPortion;
      if (taxablePortion <= 0) {
        return { rate: 0, taxableAmount: 0 };
      }
      // Blended — caller will compute VAT on taxablePortion at standard rate
      return { rate: this.VAT_RATE, taxableAmount: taxablePortion };
    }

    return { rate: transaction.taxRate ?? this.VAT_RATE, taxableAmount: transaction.amount };
  }

  async calculateVAT(
    transactions: TaxableTransaction[],
    _countryCode: string,
    period: { start: string; end: string },
  ): Promise<TaxSummary> {
    let totalSales = 0;
    let totalPurchases = 0;
    let vatOnSales = 0;
    let vatOnPurchases = 0;

    // Track SME import running total to enforce the monthly cap
    let smeImportRunningTotal = 0;

    const breakdown: Array<{ rate: number; amount: number; base: number; category?: string }> = [];

    for (const t of transactions) {
      // Accumulate SME import total before computing this transaction's rate
      if (t.category === 'sme_imports' && (t.type === 'purchase' || t.type === 'expense')) {
        const { rate, taxableAmount } = this.getEffectiveRate(t, smeImportRunningTotal);
        smeImportRunningTotal += t.amount;

        totalPurchases += t.amount;
        const base = t.isTaxInclusive && rate > 0 ? taxableAmount / (1 + rate) : taxableAmount;
        const vat = rate === 0 ? 0 : (t.isTaxInclusive ? taxableAmount - base : base * rate);
        vatOnPurchases += vat;
        breakdown.push({ rate: rate * 100, amount: -vat, base: t.amount, category: t.category });
        continue;
      }

      const { rate, taxableAmount } = this.getEffectiveRate(t, smeImportRunningTotal);

      if (t.type === 'sale') {
        totalSales += t.amount;
        const base = t.isTaxInclusive && rate > 0 ? taxableAmount / (1 + rate) : taxableAmount;
        const vat = rate === 0 ? 0 : (t.isTaxInclusive ? taxableAmount - base : base * rate);
        vatOnSales += vat;
        breakdown.push({ rate: rate * 100, amount: vat, base: t.amount, category: t.category });
      } else if (t.type === 'purchase' || t.type === 'expense') {
        totalPurchases += t.amount;
        const base = t.isTaxInclusive && rate > 0 ? taxableAmount / (1 + rate) : taxableAmount;
        const vat = rate === 0 ? 0 : (t.isTaxInclusive ? taxableAmount - base : base * rate);
        vatOnPurchases += vat;
        breakdown.push({ rate: rate * 100, amount: -vat, base: t.amount, category: t.category });
      }
    }

    vatOnSales = Math.round(vatOnSales * 100) / 100;
    vatOnPurchases = Math.round(vatOnPurchases * 100) / 100;
    totalSales = Math.round(totalSales * 100) / 100;
    totalPurchases = Math.round(totalPurchases * 100) / 100;
    const netVAT = Math.round((vatOnSales - vatOnPurchases) * 100) / 100;
    const currency = transactions[0]?.currency ?? 'XOF';

    return {
      totalVAT: netVAT,
      totalSales,
      totalPurchases,
      currency,
      period,
      breakdown,
    };
  }

  getSupportedCountries(): string[] {
    return ['BJ'];
  }
}
