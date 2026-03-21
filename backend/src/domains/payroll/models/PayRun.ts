export type PayRunStatus = 'draft' | 'finalized' | 'paid';

export interface PayRun {
  id: string;
  businessId: string;
  periodMonth: string;
  status: PayRunStatus;
  totalGross: number;
  totalNet: number;
  totalEmployerContributions: number;
  totalEmployeeDeductions: number;
  totalIncomeTax: number;
  currency: string;
  finalizedAt?: string;
  paidAt?: string;
  ledgerEntryIds?: string[];
  createdAt: string;
}

export interface CreatePayRunInput {
  businessId: string;
  periodMonth: string;
}
