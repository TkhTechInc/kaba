import { api } from "@/lib/api-client";

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
  items: InvoiceItem[];
  dueDate: string;
  status: string;
  createdAt: string;
  mecefStatus?: 'pending' | 'confirmed' | 'rejected';
  mecefQrCode?: string;
  mecefSerialNumber?: string;
  earlyPaymentDiscountPercent?: number;
  earlyPaymentDiscountDays?: number;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface CreateInvoiceInput {
  businessId: string;
  customerId: string;
  amount: number;
  currency: string;
  items: InvoiceItem[];
  dueDate: string;
  status: string;
  earlyPaymentDiscountPercent?: number;
  earlyPaymentDiscountDays?: number;
}

export interface ListInvoicesResult {
  items: Invoice[];
  total: number;
  page: number;
  limit: number;
}

export interface ListCustomersResult {
  items: Customer[];
  total: number;
  page: number;
  limit: number;
}

export function createInvoicesApi(token: string | null) {
  return {
    list: (businessId: string, page = 1, limit = 20) =>
      api.get<ListInvoicesResult>("/api/v1/invoices", {
        token: token ?? undefined,
        params: { businessId, page: String(page), limit: String(limit) },
      }),

    create: (body: CreateInvoiceInput) =>
      api.post<Invoice>("/api/v1/invoices", body, { token: token ?? undefined }),

    generatePaymentLink: (invoiceId: string, businessId: string) =>
      api.post<{ paymentUrl: string }>(`/api/v1/invoices/${invoiceId}/payment-link`, {
        businessId,
      }, { token: token ?? undefined }),

    listCustomers: (businessId: string, page = 1, limit = 100) =>
      api.get<ListCustomersResult>("/api/v1/customers", {
        token: token ?? undefined,
        params: { businessId, page: String(page), limit: String(limit) },
      }),

    createCustomer: (body: {
      businessId: string;
      name: string;
      email: string;
      phone?: string;
    }) =>
      api.post<Customer>("/api/v1/customers", body, {
        token: token ?? undefined,
      }),

    listPendingApproval: (businessId: string) =>
      api.get<{ items: Invoice[] }>("/api/v1/invoices/pending-approval", {
        token: token ?? undefined,
        params: { businessId },
      }),

    approveInvoice: (invoiceId: string, businessId: string) =>
      api.post<Invoice>(`/api/v1/invoices/${invoiceId}/approve`, { businessId }, {
        token: token ?? undefined,
      }),

    listByStatus: (businessId: string, status: string, limit = 20) =>
      api.get<{ items: Invoice[] }>("/api/v1/invoices", {
        token: token ?? undefined,
        params: { businessId, status, limit: String(limit) },
      }),
  };
}
