export type DebtStatus = 'pending' | 'paid' | 'overdue';

export interface Debt {
  id: string;
  businessId: string;
  debtorName: string;
  amount: number;
  currency: string;
  dueDate: string; // YYYY-MM-DD
  status: DebtStatus;
  customerId?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastReminderSentAt?: string;
}

export interface CreateDebtInput {
  businessId: string;
  debtorName: string;
  amount: number;
  currency: string;
  dueDate: string;
  customerId?: string;
  phone?: string;
  notes?: string;
}
