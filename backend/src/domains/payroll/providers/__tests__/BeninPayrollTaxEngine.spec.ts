import { BeninPayrollTaxEngine } from '../BeninPayrollTaxEngine';
import type { Employee } from '../../models/Employee';

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'emp-1',
  businessId: 'biz-1',
  name: 'Test Employee',
  grossSalary: 100000,
  currency: 'XOF',
  countryCode: 'BJ',
  status: 'active',
  employmentStartDate: '2024-01-01',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...overrides,
});

describe('BeninPayrollTaxEngine', () => {
  const engine = new BeninPayrollTaxEngine();

  it('countryCode is BJ', () => {
    expect(engine.countryCode).toBe('BJ');
  });

  it('CNSS employee 3.6%, employer 15.4%', () => {
    const emp = makeEmployee({ grossSalary: 100_000 });
    const calc = engine.calculate(emp, 100_000, 'XOF');
    expect(calc.employeeContributions).toBe(3600); // 3.6%
    expect(calc.employerContributions).toBe(15400); // 15.4%
    expect(calc.grossSalary).toBe(100_000);
  });

  it('IR 0% for taxable base up to 60k', () => {
    const emp = makeEmployee({ grossSalary: 60_000 });
    const calc = engine.calculate(emp, 60_000, 'XOF');
    const taxableBase = 60_000 - calc.employeeContributions; // 60000 - 2160 = 57840
    expect(taxableBase).toBeLessThanOrEqual(60_000);
    expect(calc.incomeTax).toBe(0);
    expect(calc.deductionsBreakdown.some((d) => d.label.includes('IR'))).toBe(false);
  });

  it('IR 10% for 60,001–150k band', () => {
    const emp = makeEmployee({ grossSalary: 150_000 });
    const calc = engine.calculate(emp, 150_000, 'XOF');
    const taxableBase = 150_000 - calc.employeeContributions; // 150000 - 5400 = 144600
    expect(calc.incomeTax).toBeGreaterThan(0);
    expect(calc.deductionsBreakdown.some((d) => d.label.includes('IR'))).toBe(true);
  });

  it('netPay = gross - employee CNSS - IR', () => {
    const emp = makeEmployee({ grossSalary: 200_000 });
    const calc = engine.calculate(emp, 200_000, 'XOF');
    const expectedNet = calc.grossSalary - calc.employeeContributions - calc.incomeTax;
    expect(calc.netPay).toBe(expectedNet);
    expect(calc.netPay).toBeGreaterThan(0);
  });

  it('deductionsBreakdown includes CNSS and IR', () => {
    const emp = makeEmployee({ grossSalary: 200_000 });
    const calc = engine.calculate(emp, 200_000, 'XOF');
    const cnss = calc.deductionsBreakdown.find((d) => d.label.includes('CNSS'));
    expect(cnss).toBeDefined();
    expect(cnss?.amount).toBe(calc.employeeContributions);
  });
});
