import {
  api,
  apiGetWithOfflineCache,
} from "@/lib/api-client";
import { CACHE_KEYS, listCacheKey, getCached, setCached } from "@/lib/offline-cache";
import type { ApiResponse } from "@/lib/api-client";
import { offlineMutation } from "@/lib/offline-api";

export type DebtStatus = "pending" | "paid" | "overdue";

export interface Debt {
  id: string;
  businessId: string;
  debtorName: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: DebtStatus;
  customerId?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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

export interface ListDebtsResult {
  items: Debt[];
  total: number;
  page: number;
  limit: number;
}

export interface SendReminderResult {
  sent: boolean;
  channel?: "sms" | "whatsapp";
}

async function patchDebtsCache(
  businessId: string,
  updater: (
    cached: ApiResponse<ListDebtsResult>
  ) => { items: Debt[]; total: number }
) {
  const cacheKeyVariants = [
    listCacheKey(CACHE_KEYS.DEBTS, businessId, {
      businessId,
      page: "1",
      limit: "20",
    }),
    listCacheKey(CACHE_KEYS.DEBTS, businessId, {
      businessId,
      page: "1",
      limit: "20",
      status: "pending",
    }),
    listCacheKey(CACHE_KEYS.DEBTS, businessId, {
      businessId,
      page: "1",
      limit: "20",
      status: "paid",
    }),
  ];
  for (const cacheKey of cacheKeyVariants) {
    try {
      const cached = await getCached<ApiResponse<ListDebtsResult>>(cacheKey);
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
}

export function createDebtsApi(token: string | null) {
  return {
    list: (businessId: string, page = 1, limit = 20, status?: DebtStatus, fromDate?: string, toDate?: string) => {
      const params: Record<string, string> = {
        businessId,
        page: String(page),
        limit: String(limit),
        ...(status && { status }),
        ...(fromDate && { fromDate }),
        ...(toDate && { toDate }),
      };
      return apiGetWithOfflineCache<ListDebtsResult>(
        "/api/v1/debts",
        listCacheKey(CACHE_KEYS.DEBTS, businessId, params),
        { token: token ?? undefined, params }
      );
    },

    create: async (body: CreateDebtInput) => {
      const optimistic: Debt = {
        id: "pending-" + Date.now(),
        businessId: body.businessId,
        debtorName: body.debtorName,
        amount: body.amount,
        currency: body.currency,
        dueDate: body.dueDate,
        status: "pending",
        customerId: body.customerId,
        phone: body.phone,
        notes: body.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = await offlineMutation<Debt>(
        "/api/v1/debts",
        "POST",
        body,
        token,
        optimistic
      );
      const debt = result.data;
      if (debt?.id) {
        await patchDebtsCache(body.businessId, (cached) => ({
          items: [debt, ...cached.data.items],
          total: cached.data.total + 1,
        }));
      }
      return result.data;
    },

    markPaid: async (businessId: string, id: string) => {
      const optimistic: Debt = {
        id,
        businessId,
        debtorName: "",
        amount: 0,
        currency: "",
        dueDate: "",
        status: "paid",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = await offlineMutation<Debt>(
        `/api/v1/debts/${id}/mark-paid?businessId=${encodeURIComponent(businessId)}`,
        "POST",
        {},
        token,
        optimistic
      );
      const debt = result.data;
      if (debt?.id) {
        await patchDebtsCache(businessId, (cached) => {
          const existing = cached.data.items.find((d) => d.id === id);
          const updated = existing
            ? { ...existing, status: "paid" as const, updatedAt: debt.updatedAt }
            : debt;
          return {
            items: cached.data.items.map((d) => (d.id === id ? updated : d)),
            total: cached.data.total,
          };
        });
      }
      return result.data;
    },

    sendReminder: async (businessId: string, id: string) => {
      const result = await offlineMutation<SendReminderResult>(
        `/api/v1/debts/${id}/remind?businessId=${encodeURIComponent(businessId)}`,
        "POST",
        {},
        token,
        { sent: false, channel: undefined }
      );
      return result.data;
    },
  };
}
