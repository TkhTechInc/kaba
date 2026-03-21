export interface DeductionBreakdown {
  label: string;
  amount: number;
  rate?: number;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface PayRunLine {
  id: string;
  payRunId: string;
  businessId: string;
  employeeId: string;
  grossSalary: number;
  employeeContributions: number;
  employerContributions: number;
  incomeTax: number;
  deductionsBreakdown: DeductionBreakdown[];
  netPay: number;
  paymentStatus?: PaymentStatus;
  payslipUrl?: string;
  createdAt: string;
}
