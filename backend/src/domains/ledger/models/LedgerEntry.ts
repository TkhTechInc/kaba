export type LedgerEntryType = 'sale' | 'expense';

export interface LedgerEntry {
  id: string;
  businessId: string;
  type: LedgerEntryType;
  amount: number;
  currency: string;
  description: string;
  category: string;
  date: string;
  createdAt: string;
  /** Set when soft-deleted (compliance erasure). */
  deletedAt?: string;
}

export interface CreateLedgerEntryInput {
  businessId: string;
  type: LedgerEntryType;
  amount: number;
  currency: string;
  description: string;
  category: string;
  date: string;
  smsPhone?: string;
}
