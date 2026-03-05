import { TaxEngineManager } from '../TaxEngineManager';
import { ValidationError } from '@/shared/errors/DomainError';
import type { TaxableTransaction } from '../ITaxEngine';

describe('TaxEngineManager', () => {
  const manager = new TaxEngineManager();

  const sampleTransactions: TaxableTransaction[] = [
    { id: '1', amount: 1000, currency: 'NGN', type: 'sale' },
    { id: '2', amount: 500, currency: 'NGN', type: 'purchase' },
  ];

  const period = { start: '2024-01-01', end: '2024-01-31' };

  it('getSupportedCountries returns NG, GH, BJ', () => {
    const countries = manager.getSupportedCountries();
    expect(countries).toContain('NG');
    expect(countries).toContain('GH');
    expect(countries).toContain('BJ');
    expect(countries.length).toBe(3);
  });

  it('calculateVAT delegates to Nigeria for NG', async () => {
    const result = await manager.calculateVAT(sampleTransactions, 'NG', period);
    expect(result.currency).toBe('NGN');
    expect(result.period).toEqual(period);
    expect(typeof result.totalVAT).toBe('number');
    expect(typeof result.totalSales).toBe('number');
    expect(typeof result.totalPurchases).toBe('number');
  });

  it('calculateVAT delegates to Ghana for GH', async () => {
    const result = await manager.calculateVAT(sampleTransactions, 'GH', period);
    expect(result.currency).toBe('NGN');
    expect(result.period).toEqual(period);
  });

  it('calculateVAT delegates to Benin for BJ', async () => {
    const result = await manager.calculateVAT(sampleTransactions, 'BJ', period);
    expect(result.currency).toBe('NGN');
    expect(result.period).toEqual(period);
  });

  it('calculateVAT accepts lowercase country codes', async () => {
    const result = await manager.calculateVAT(sampleTransactions, 'ng', period);
    expect(result.currency).toBe('NGN');
  });

  it('throws ValidationError for unsupported country', async () => {
    await expect(
      manager.calculateVAT(sampleTransactions, 'XX', period),
    ).rejects.toThrow(ValidationError);
    await expect(
      manager.calculateVAT(sampleTransactions, 'XX', period),
    ).rejects.toThrow('Unsupported country code');
  });
});
