import { PayrollTaxEngineManager } from '../PayrollTaxEngineManager';
import type { Employee } from '../../models/Employee';

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'emp-1',
  businessId: 'biz-1',
  name: 'Test',
  grossSalary: 100_000,
  currency: 'XOF',
  countryCode: 'BJ',
  status: 'active',
  employmentStartDate: '2024-01-01',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...overrides,
});

describe('PayrollTaxEngineManager', () => {
  const manager = new PayrollTaxEngineManager();

  it('getEngine returns Benin engine for BJ', () => {
    const engine = manager.getEngine('BJ');
    expect(engine.countryCode).toBe('BJ');
    const calc = engine.calculate(makeEmployee(), 100_000, 'XOF');
    expect(calc.employeeContributions).toBeGreaterThan(0);
    expect(calc.employerContributions).toBeGreaterThan(0);
  });

  it('getEngine returns Benin for lowercase bj', () => {
    const engine = manager.getEngine('bj');
    expect(engine.countryCode).toBe('BJ');
  });

  it('getEngine returns Stub for unknown country', () => {
    const engine = manager.getEngine('NG');
    expect(engine.countryCode).toBe('STUB');
    const calc = engine.calculate(makeEmployee(), 100_000, 'XOF');
    expect(calc.employeeContributions).toBe(0);
    expect(calc.employerContributions).toBe(0);
    expect(calc.incomeTax).toBe(0);
    expect(calc.netPay).toBe(100_000);
  });

  it('getEngine returns Stub for empty string', () => {
    const engine = manager.getEngine('');
    expect(engine.countryCode).toBe('STUB');
  });

  it('getSupportedCountries returns BJ', () => {
    expect(manager.getSupportedCountries()).toEqual(['BJ']);
  });
});
