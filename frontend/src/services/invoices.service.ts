import {
  api,
  apiGetWithOfflineCache,
} from "@/lib/api-client";
import { CACHE_KEYS, listCacheKey, getCached, setCached } from "@/lib/offline-cache";
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
    list: (businessId: string, page = 1, limit = 20, status?: string) => {
      const params: Record<string, string> = {
        businessId,
        page: String(page),
        limit: String(limit),
      };
      if (status) params.status = status;
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
      const invoice = result.data;
      if (invoice?.id) {
        await patchInvoicesCache(body.businessId, (cached) => ({
          items: [invoice, ...cached.data.items],
          total: cached.data.total + 1,
        }));
      }
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

    listCustomers: (businessId: string, page = 1, limit = 100) => {
      const params = {
        businessId,
        page: String(page),
        limit: String(limit),
      };
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

      // Patch all cached customers lists so this customer persists
      // even when lists are re-read from cache (e.g. on re-render while offline).
      if (customer?.id) {
        const cacheKeyVariants = [
          listCacheKey(CACHE_KEYS.CUSTOMERS, body.businessId, {
            businessId: body.businessId,
            limit: "100",
            page: "1",
          }),
          listCacheKey(CACHE_KEYS.CUSTOMERS, body.businessId, {
            businessId: body.businessId,
            limit: "20",
            page: "1",
          }),
        ];
        for (const cacheKey of cacheKeyVariants) {
          try {
            const cached = await getCached<ApiResponse<ListCustomersResult>>(cacheKey);
            if (cached?.data) {
              const alreadyIn = cached.data.items.some((c) => c.id === customer.id);
              if (!alreadyIn) {
                await setCached(cacheKey, {
                  ...cached,
                  data: {
                    ...cached.data,
                    items: [customer, ...cached.data.items],
                    total: cached.data.total + 1,
                  },
                });
              }
            }
          } catch {
            // cache patch is best-effort
          }
        }
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
  };
}
