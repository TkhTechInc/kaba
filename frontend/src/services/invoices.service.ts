import {
  api,
  apiGetWithOfflineCache,
} from "@/lib/api-client";
import { CACHE_KEYS, listCacheKey, getCached, setCached, deleteCachedByPrefix } from "@/lib/offline-cache";
import type { ApiResponse } from "@/lib/api-client";
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

function isInvoice(value: unknown): value is Invoice {
  return !!value && typeof value === "object" && "id" in value;
}

async function patchInvoicesCache(
  businessId: string,
  updater: (
    cached: ApiResponse<ListInvoicesResult>
  ) => { items: Invoice[]; total: number }
) {
  const cacheKey = listCacheKey(CACHE_KEYS.INVOICES, businessId, {
    businessId,
    page: "1",
    limit: "20",
  });
  try {
    const cached = await getCached<ApiResponse<ListInvoicesResult>>(cacheKey);
    if (cached?.data) {
      const { items, total } = updater(cached);
      await setCached(cacheKey, {
        ...cached,
        data: { ...cached.data, items, total },
      });
    }
  } catch {
    /* best-effort */
  }
}

async function patchInvoicesPendingCache(businessId: string, removedInvoiceId: string) {
  const cacheKey = listCacheKey(CACHE_KEYS.INVOICES_PENDING_APPROVAL, businessId, {
    businessId,
  });
  try {
    const cached = await getCached<ApiResponse<{ items: Invoice[] }>>(cacheKey);
    if (cached?.data) {
      await setCached(cacheKey, {
        ...cached,
        data: {
          items: cached.data.items.filter((i) => i.id !== removedInvoiceId),
        },
      });
    }
  } catch {
    /* best-effort */
  }
}

export function createInvoicesApi(token: string | null) {
  return {
    list: (businessId: string, page = 1, limit = 20, status?: string, fromDate?: string, toDate?: string) => {
      const params: Record<string, string> = {
        businessId,
        page: String(page),
        limit: String(limit),
      };
      if (status) params.status = status;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      return apiGetWithOfflineCache<ListInvoicesResult>(
        "/api/v1/invoices",
        listCacheKey(CACHE_KEYS.INVOICES, businessId, params),
        { token: token ?? undefined, params }
      );
    },

    getById: (invoiceId: string, businessId: string) =>
      api.get<Invoice>(`/api/v1/invoices/${invoiceId}`, {
        token: token ?? undefined,
        params: { businessId },
      }),

    create: async (body: CreateInvoiceInput): Promise<Invoice> => {
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
      const result = await offlineMutation<Invoice | { success?: boolean; data?: Invoice }>(
        "/api/v1/invoices",
        "POST",
        body,
        token,
        optimistic
      );
      // Backend may return either Invoice or { success, data: Invoice }.
      const invoice = isInvoice(result.data)
        ? result.data
        : result.data?.data;
      const resolvedInvoice = invoice ?? optimistic;
      if (resolvedInvoice.id && !resolvedInvoice.id.startsWith("pending-")) {
        await patchInvoicesCache(body.businessId, (cached) => ({
          items: [resolvedInvoice, ...cached.data.items],
          total: cached.data.total + 1,
        }));
      }
      return resolvedInvoice;
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
      const invoice = result.data;
      if (invoice?.id) {
        await patchInvoicesCache(businessId, (cached) => ({
          items: cached.data.items.map((i) => (i.id === invoiceId ? invoice : i)),
          total: cached.data.total,
        }));
      }
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

    getWhatsAppLink: (invoiceId: string, businessId: string) =>
      api
        .get<{ url: string }>(`/api/v1/invoices/${invoiceId}/whatsapp-link`, {
          token: token ?? undefined,
          params: { businessId },
        })
        .then((r) => r.data.url),

    /** Send invoice directly to customer via WhatsApp API. Returns { success, messageId } or throws. */
    sendWhatsApp: (invoiceId: string, businessId: string) =>
      api.post<{ success: boolean; messageId?: string }>(
        `/api/v1/invoices/${invoiceId}/send-whatsapp`,
        { businessId },
        { token: token ?? undefined }
      ),

    listCustomers: (businessId: string, page = 1, limit = 100, fromDate?: string, toDate?: string) => {
      const params: Record<string, string> = {
        businessId,
        page: String(page),
        limit: String(limit),
      };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      return apiGetWithOfflineCache<ListCustomersResult>(
        "/api/v1/customers",
        listCacheKey(CACHE_KEYS.CUSTOMERS, businessId, params),
        { token: token ?? undefined, params }
      );
    },

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
      const customer = result.data;

      // Invalidate all customer list caches so the next load fetches fresh data.
      // This ensures new customers appear even when date filters or other params were used.
      try {
        await deleteCachedByPrefix(`${CACHE_KEYS.CUSTOMERS}:${body.businessId}`);
      } catch {
        // best-effort
      }

      return customer;
    },

    listPendingApproval: (businessId: string) =>
      apiGetWithOfflineCache<{ items: Invoice[] }>(
        "/api/v1/invoices/pending-approval",
        listCacheKey(CACHE_KEYS.INVOICES_PENDING_APPROVAL, businessId, {
          businessId,
        }),
        { token: token ?? undefined, params: { businessId } }
      ),

    approveInvoice: async (invoiceId: string, businessId: string) => {
      const optimistic: Invoice = {
        id: invoiceId,
        businessId,
        customerId: "",
        amount: 0,
        currency: "",
        items: [],
        dueDate: "",
        status: "draft",
        createdAt: new Date().toISOString(),
      };
      const result = await offlineMutation<Invoice>(
        `/api/v1/invoices/${invoiceId}/approve`,
        "POST",
        { businessId },
        token,
        optimistic
      );
      const invoice = result.data;
      if (invoice?.id) {
        await patchInvoicesCache(businessId, (cached) => ({
          items: cached.data.items.map((i) => (i.id === invoiceId ? invoice : i)),
          total: cached.data.total,
        }));
        await patchInvoicesPendingCache(businessId, invoiceId);
      }
      return result.data;
    },

    listByStatus: (businessId: string, status: string, limit = 20) => {
      const params = {
        businessId,
        status,
        limit: String(limit),
      };
      return apiGetWithOfflineCache<{ items: Invoice[] }>(
        "/api/v1/invoices",
        listCacheKey(CACHE_KEYS.INVOICES, businessId, params),
        { token: token ?? undefined, params }
      );
    },

    /**
     * Mark an invoice as paid via cash (POS in-store).
     * No payment gateway — just transitions status to 'paid'.
     */
    markPaidCash: async (invoiceId: string, businessId: string) => {
      const result = await api.post<ApiResponse<Invoice>>(
        `/api/v1/invoices/${encodeURIComponent(invoiceId)}/mark-paid`,
        { businessId },
        { token: token ?? undefined }
      );
      await deleteCachedByPrefix(listCacheKey(CACHE_KEYS.INVOICES, businessId, {}));
      return result.data;
    },

    /**
     * Download invoice/receipt/thermal PDF.
     * Opens the PDF in a new browser tab for printing or download.
     * mode: 'invoice' | 'receipt' | 'thermal'
     */
    downloadPdf: (invoiceId: string, businessId: string, mode: 'invoice' | 'receipt' | 'thermal' = 'invoice') => {
      const params = new URLSearchParams({ businessId, mode });
      const url = `/api/v1/invoices/${encodeURIComponent(invoiceId)}/pdf?${params.toString()}`;
      // Open via fetch so we can inject the auth header, then trigger browser download
      return fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then(async (res) => {
        if (!res.ok) throw new Error(`PDF download failed: ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `${mode}-${invoiceId.slice(0, 12)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
      });
    },
  };
}
