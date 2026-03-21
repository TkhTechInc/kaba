import type { Employee } from '../models/Employee';

export interface DeductionBreakdown {
  label: string;
  amount: number;
  rate?: number;
}

export interface PayrollCalculation {
  grossSalary: number;
  employeeContributions: number;
  employerContributions: number;
  incomeTax: number;
  deductionsBreakdown: DeductionBreakdown[];
  netPay: number;
}

export interface IPayrollTaxEngine {
  readonly countryCode: string;
  calculate(employee: Employee, grossSalary: number, currency: string): PayrollCalculation;
}
