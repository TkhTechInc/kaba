export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'pending_approval';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  businessId: string;
  customerId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  dueDate: string;
  createdAt: string;
  /** Set when soft-deleted (compliance erasure). */
  deletedAt?: string;
  /** Early payment discount: percent off if paid within N days. */
  earlyPaymentDiscountPercent?: number;
  /** Days from invoice date within which early payment discount applies. */
  earlyPaymentDiscountDays?: number;
  /** MECeF: temporary DGI validation token (Benin only). Cleared after confirmation. */
  mecefToken?: string;
  /** MECeF: current DGI validation status (Benin only). */
  mecefStatus?: 'pending' | 'confirmed' | 'rejected';
  /** MECeF: QR code data from DGI (set after confirmation). */
  mecefQrCode?: string;
  /** MECeF: official fiscal serial number (NIM_Facture) from DGI. */
  mecefSerialNumber?: string;
}

export interface CreateInvoiceInput {
  businessId: string;
  customerId: string;
  amount: number;
  currency: string;
  items: InvoiceItem[];
  dueDate: string;
  status?: InvoiceStatus;
  earlyPaymentDiscountPercent?: number;
  earlyPaymentDiscountDays?: number;
}
