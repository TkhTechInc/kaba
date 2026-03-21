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
  /** Product ID when sale is from inventory (type=sale). */
  productId?: string;
  /** Quantity sold when sale is from inventory (type=sale). */
  quantitySold?: number;
  /** Original currency when different from ledger currency (multi-currency). */
  originalCurrency?: string;
  /** Exchange rate used (e.g. 1 originalCurrency = X ledger currency). */
  exchangeRate?: number;
  /** Forex gain/loss amount in ledger currency. */
  forexGainLoss?: number;
  /** Supplier ID when entry is a supplier payment (type=expense, category=supplier_payment). */
  supplierId?: string;
  /** Accounting category for OHADA chart of accounts. */
  accountingCategory?: string;
  /** Debit entries for double-entry bookkeeping. */
  debits?: Array<{ account: string; amount: number }>;
  /** Credit entries for double-entry bookkeeping. */
  credits?: Array<{ account: string; amount: number }>;
  /** Metadata for reversing entries and audit trail. */
  metadata?: {
    reversalOf?: string;
    reversalReason?: string;
    reversedAt?: string;
    reversedBy?: string;
    [key: string]: unknown;
  };
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
  productId?: string;
  quantitySold?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  forexGainLoss?: number;
  supplierId?: string;
  /** When true, skip ledger limit check (e.g. for system-generated entries from invoice payment). */
  skipLimitCheck?: boolean;
  /** Accounting category for OHADA chart of accounts. */
  accountingCategory?: string;
  /** Debit entries for double-entry bookkeeping. */
  debits?: Array<{ account: string; amount: number }>;
  /** Credit entries for double-entry bookkeeping. */
  credits?: Array<{ account: string; amount: number }>;
  /** Metadata for reversing entries and audit trail. */
  metadata?: {
    reversalOf?: string;
    reversalReason?: string;
    reversedAt?: string;
    reversedBy?: string;
    [key: string]: unknown;
  };
}
