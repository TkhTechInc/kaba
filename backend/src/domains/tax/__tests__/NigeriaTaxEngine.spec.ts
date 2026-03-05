import { NigeriaTaxEngine } from '../NigeriaTaxEngine';
import type { TaxableTransaction } from '../ITaxEngine';

describe('NigeriaTaxEngine', () => {
  const engine = new NigeriaTaxEngine();

  it('getSupportedCountries returns NG', () => {
    expect(engine.getSupportedCountries()).toEqual(['NG']);
  });

  it('calculateVAT for tax-exclusive sale', async () => {
    const transactions: TaxableTransaction[] = [
      { id: '1', amount: 1000, currency: 'NGN', type: 'sale', isTaxInclusive: false },
    ];
    const result = await engine.calculateVAT(
      transactions,
      'NG',
      { start: '2024-01-01', end: '2024-01-31' },
    );
    expect(result.totalSales).toBe(1000);
    expect(result.totalVAT).toBeCloseTo(75, 2); // 7.5% of 1000
    expect(result.currency).toBe('NGN');
  });

  it('calculateVAT for tax-inclusive sale', async () => {
    const transactions: TaxableTransaction[] = [
      { id: '1', amount: 1075, currency: 'NGN', type: 'sale', isTaxInclusive: true },
    ];
    const result = await engine.calculateVAT(
      transactions,
      'NG',
      { start: '2024-01-01', end: '2024-01-31' },
    );
    expect(result.totalSales).toBe(1075);
    // VAT = 1075 - 1075/1.075 ≈ 75
    expect(result.totalVAT).toBeCloseTo(75, 1);
  });

  it('calculateVAT nets sales and purchases', async () => {
    const transactions: TaxableTransaction[] = [
      { id: '1', amount: 1000, currency: 'NGN', type: 'sale' },
      { id: '2', amount: 400, currency: 'NGN', type: 'purchase' },
    ];
    const result = await engine.calculateVAT(
      transactions,
      'NG',
      { start: '2024-01-01', end: '2024-01-31' },
    );
    expect(result.totalSales).toBe(1000);
    expect(result.totalPurchases).toBe(400);
    expect(result.totalVAT).toBeGreaterThan(0);
    expect(result.breakdown).toHaveLength(2);
  });

  it('returns empty summary for no transactions', async () => {
    const result = await engine.calculateVAT(
      [],
      'NG',
      { start: '2024-01-01', end: '2024-01-31' },
    );
    expect(result.totalSales).toBe(0);
    expect(result.totalPurchases).toBe(0);
    expect(result.totalVAT).toBe(0);
    expect(result.currency).toBe('NGN'); // default when no transactions
  });
});
