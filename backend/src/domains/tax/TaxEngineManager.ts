import type { ITaxEngine, TaxableTransaction, TaxSummary } from './ITaxEngine';
import { NigeriaTaxEngine } from './NigeriaTaxEngine';
import { GhanaTaxEngine } from './GhanaTaxEngine';
import { BeninTaxEngine } from './BeninTaxEngine';
import { ValidationError } from '@/shared/errors/DomainError';

/**
 * Routes to country-specific tax engine.
 */
export class TaxEngineManager implements ITaxEngine {
  private nigeria = new NigeriaTaxEngine();
  private ghana = new GhanaTaxEngine();
  private benin = new BeninTaxEngine();

  private getEngine(countryCode: string): ITaxEngine {
    const code = (countryCode || '').toUpperCase();
    if (code === 'NG') return this.nigeria;
    if (code === 'GH') return this.ghana;
    if (code === 'BJ') return this.benin;
    throw new ValidationError(`Unsupported country code: ${code}. Supported: NG, GH, BJ`);
  }

  async calculateVAT(
    transactions: TaxableTransaction[],
    countryCode: string,
    period: { start: string; end: string },
  ): Promise<TaxSummary> {
    return this.getEngine(countryCode).calculateVAT(transactions, countryCode, period);
  }

  getSupportedCountries(): string[] {
    const set = new Set<string>();
    this.nigeria.getSupportedCountries().forEach((c) => set.add(c));
    this.ghana.getSupportedCountries().forEach((c) => set.add(c));
    this.benin.getSupportedCountries().forEach((c) => set.add(c));
    return Array.from(set);
  }
}
