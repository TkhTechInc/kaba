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
}
