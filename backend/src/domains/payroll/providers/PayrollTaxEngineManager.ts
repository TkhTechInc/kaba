import type { IPayrollTaxEngine } from '../interfaces/IPayrollTaxEngine';
import { BeninPayrollTaxEngine } from './BeninPayrollTaxEngine';
import { StubPayrollTaxEngine } from './StubPayrollTaxEngine';

const ENGINES: Map<string, IPayrollTaxEngine> = new Map([
  ['BJ', new BeninPayrollTaxEngine()],
]);

const STUB = new StubPayrollTaxEngine();

/**
 * Resolves the payroll tax engine by country code.
 * Returns StubPayrollTaxEngine for unsupported countries (gross = net).
 */
export class PayrollTaxEngineManager {
  getEngine(countryCode: string): IPayrollTaxEngine {
    const normalized = (countryCode ?? '').toUpperCase().trim();
    return ENGINES.get(normalized) ?? STUB;
  }

  getSupportedCountries(): string[] {
    return Array.from(ENGINES.keys());
  }
}
