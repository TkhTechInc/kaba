import type { Employee } from '../models/Employee';
import type { IPayrollTaxEngine, PayrollCalculation } from '../interfaces/IPayrollTaxEngine';

/**
 * Fallback engine for unsupported countries. No contributions or tax — gross = net.
 */
export class StubPayrollTaxEngine implements IPayrollTaxEngine {
  readonly countryCode = 'STUB';

  calculate(employee: Employee, grossSalary: number, _currency: string): PayrollCalculation {
    return {
      grossSalary,
      employeeContributions: 0,
      employerContributions: 0,
      incomeTax: 0,
      deductionsBreakdown: [],
      netPay: grossSalary,
    };
  }
}
