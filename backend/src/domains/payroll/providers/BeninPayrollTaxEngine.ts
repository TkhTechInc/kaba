import type { Employee } from '../models/Employee';
import type { IPayrollTaxEngine, PayrollCalculation, DeductionBreakdown } from '../interfaces/IPayrollTaxEngine';

/**
 * Benin payroll tax engine — CNSS + IR (progressive).
 * CNSS: Employee 3.6%, Employer 15.4% (6.4% pension + 9% family allowance).
 * IR: 0% up to 60k XOF; 10% 60,001–150k; 15% 150,001–250k; 20% 250,001–500k; 30% above 500k.
 * Taxable base for IR = gross - CNSS employee.
 */
const CNSS_EMPLOYEE_RATE = 0.036;
const CNSS_EMPLOYER_RATE = 0.154;

const IR_BANDS: { max: number; rate: number }[] = [
  { max: 60_000, rate: 0 },
  { max: 150_000, rate: 0.1 },
  { max: 250_000, rate: 0.15 },
  { max: 500_000, rate: 0.2 },
  { max: Infinity, rate: 0.3 },
];

export class BeninPayrollTaxEngine implements IPayrollTaxEngine {
  readonly countryCode = 'BJ';

  calculate(employee: Employee, grossSalary: number, currency: string): PayrollCalculation {
    const cnssEmployee = Math.round(grossSalary * CNSS_EMPLOYEE_RATE);
    const cnssEmployer = Math.round(grossSalary * CNSS_EMPLOYER_RATE);
    const taxableBase = grossSalary - cnssEmployee;
    const { ir, irBreakdown } = this.calculateIR(taxableBase);
    const netPay = grossSalary - cnssEmployee - ir;

    const deductionsBreakdown: DeductionBreakdown[] = [
      { label: 'CNSS (employé)', amount: cnssEmployee, rate: CNSS_EMPLOYEE_RATE * 100 },
      ...irBreakdown,
    ];

    return {
      grossSalary,
      employeeContributions: cnssEmployee,
      employerContributions: cnssEmployer,
      incomeTax: ir,
      deductionsBreakdown,
      netPay: Math.max(0, netPay),
    };
  }

  private calculateIR(taxableBase: number): { ir: number; irBreakdown: DeductionBreakdown[] } {
    if (taxableBase <= 0) return { ir: 0, irBreakdown: [] };

    let remaining = taxableBase;
    let totalIr = 0;
    const irBreakdown: DeductionBreakdown[] = [];
    let prevMax = 0;

    for (const band of IR_BANDS) {
      const bandWidth = Math.min(remaining, band.max - prevMax);
      if (bandWidth <= 0) break;
      const bandTax = Math.round(bandWidth * band.rate);
      totalIr += bandTax;
      if (band.rate > 0) {
        irBreakdown.push({
          label: `IR ${prevMax.toLocaleString()}-${band.max === Infinity ? '∞' : band.max.toLocaleString()} XOF`,
          amount: bandTax,
          rate: band.rate * 100,
        });
      }
      remaining -= bandWidth;
      prevMax = band.max;
      if (remaining <= 0) break;
    }

    return { ir: totalIr, irBreakdown };
  }
}
