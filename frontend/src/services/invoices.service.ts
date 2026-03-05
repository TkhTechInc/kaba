import { api } from "@/lib/api-client";
import { offlineMutation } from "@/lib/offline-api";

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

    getById: (invoiceId: string, businessId: string) =>
      api.get<Invoice>(`/api/v1/invoices/${invoiceId}`, {
        token: token ?? undefined,
        params: { businessId },
      }),

    create: async (body: CreateInvoiceInput) => {
      const optimistic: Invoice = {
        id: "pending-" + Date.now(),
        businessId: body.businessId,
        customerId: body.customerId,
        amount: body.amount,
        currency: body.currency,
        items: body.items,
        dueDate: body.dueDate,
        status: body.status,
        createdAt: new Date().toISOString(),
      };
      const result = await offlineMutation<Invoice>(
        "/api/v1/invoices",
        "POST",
        body,
        token,
        optimistic
      );
      return result.data;
    },

    update: async (invoiceId: string, businessId: string, body: Partial<CreateInvoiceInput>) => {
      const optimistic: Invoice = {
        id: invoiceId,
        businessId,
        customerId: body.customerId ?? "",
        amount: body.amount ?? 0,
        currency: body.currency ?? "",
        items: body.items ?? [],
        dueDate: body.dueDate ?? "",
        status: body.status ?? "",
        createdAt: new Date().toISOString(),
        ...body,
      };
      const result = await offlineMutation<Invoice>(
        `/api/v1/invoices/${invoiceId}?businessId=${encodeURIComponent(businessId)}`,
        "PATCH",
        body,
        token,
        optimistic
      );
      return result.data;
    },

    generatePaymentLink: async (invoiceId: string, businessId: string) => {
      const result = await offlineMutation<{ paymentUrl: string }>(
        `/api/v1/invoices/${invoiceId}/payment-link`,
        "POST",
        { businessId },
        token,
        { paymentUrl: "pending" }
      );
      return result.data;
    },

    listCustomers: (businessId: string, page = 1, limit = 100) =>
      api.get<ListCustomersResult>("/api/v1/customers", {
        token: token ?? undefined,
        params: { businessId, page: String(page), limit: String(limit) },
      }),

    createCustomer: async (body: {
      businessId: string;
      name: string;
      email: string;
      phone?: string;
    }) => {
      const optimistic: Customer = {
        id: "pending-" + Date.now(),
        businessId: body.businessId,
        name: body.name,
        email: body.email,
        phone: body.phone,
      };
      const result = await offlineMutation<Customer>(
        "/api/v1/customers",
        "POST",
        body,
        token,
        optimistic
      );
      return result.data;
    },

    listPendingApproval: (businessId: string) =>
      api.get<{ items: Invoice[] }>("/api/v1/invoices/pending-approval", {
        token: token ?? undefined,
        params: { businessId },
      }),

    approveInvoice: async (invoiceId: string, businessId: string) => {
      const optimistic: Invoice = {
        id: invoiceId,
        businessId,
        customerId: "",
        amount: 0,
        currency: "",
        items: [],
        dueDate: "",
        status: "approved",
        createdAt: new Date().toISOString(),
      };
      const result = await offlineMutation<Invoice>(
        `/api/v1/invoices/${invoiceId}/approve`,
        "POST",
        { businessId },
        token,
        optimistic
      );
      return result.data;
    },

    listByStatus: (businessId: string, status: string, limit = 20) =>
      api.get<{ items: Invoice[] }>("/api/v1/invoices", {
        token: token ?? undefined,
        params: { businessId, status, limit: String(limit) },
      }),
  };
}
