import {
  api,
  apiGetWithOfflineCache,
} from "@/lib/api-client";
import { CACHE_KEYS, listCacheKey, getCached, setCached } from "@/lib/offline-cache";
import type { ApiResponse } from "@/lib/api-client";
import { offlineMutation } from "@/lib/offline-api";

export type LedgerEntryType = "sale" | "expense";

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
}

export interface CreateLedgerEntryInput {
  businessId: string;
  type: LedgerEntryType;
  amount: number;
  currency: string;
  date: string;
  description?: string;
  category?: string;
  smsPhone?: string;
  productId?: string;
  quantitySold?: number;
}

export interface ListEntriesResult {
  items: LedgerEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface BalanceResult {
  balance: number;
  currency: string;
}

async function patchLedgerCaches(
  businessId: string,
  entry: LedgerEntry
) {
  const entriesKey = listCacheKey(CACHE_KEYS.LEDGER_ENTRIES, businessId, {
    businessId,
    page: "1",
    limit: "20",
  });
  const balanceKey = listCacheKey(CACHE_KEYS.LEDGER_BALANCE, businessId, {
    businessId,
  });
  try {
    const entriesCached = await getCached<ApiResponse<ListEntriesResult>>(entriesKey);
    if (entriesCached?.data) {
      await setCached(entriesKey, {
        ...entriesCached,
        data: {
          ...entriesCached.data,
          items: [entry, ...entriesCached.data.items],
          total: entriesCached.data.total + 1,
        },
      });
    }
    const balanceCached = await getCached<ApiResponse<BalanceResult>>(balanceKey);
    if (balanceCached?.data && balanceCached.data.currency === entry.currency) {
      const delta = entry.type === "sale" ? entry.amount : -entry.amount;
      await setCached(balanceKey, {
        ...balanceCached,
        data: {
          ...balanceCached.data,
          balance: balanceCached.data.balance + delta,
        },
      });
    }
  } catch {
    /* best-effort */
  }
}

export function createLedgerApi(token: string | null) {
  return {
    listEntries: (businessId: string, page = 1, limit = 20, type?: string, fromDate?: string, toDate?: string) => {
      if (!businessId?.trim()) {
        return Promise.reject(new Error("Business ID is required"));
      }
      const params: Record<string, string> = {
        businessId: businessId.trim(),
        page: String(page),
        limit: String(limit),
      };
      if (type && type !== "all") params.type = type;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      return apiGetWithOfflineCache<ListEntriesResult>(
        "/api/v1/ledger/entries",
        listCacheKey(CACHE_KEYS.LEDGER_ENTRIES, businessId, params),
        { token: token ?? undefined, params }
      );
    },

    createEntry: async (body: CreateLedgerEntryInput) => {
      if (!body.businessId?.trim()) {
        throw new Error("Business ID is required");
      }
      if (!body.currency?.trim() || body.currency.length !== 3) {
        throw new Error("Currency must be a 3-letter code (e.g. XOF, NGN)");
      }
      if (!body.date?.match(/^\d{4}-\d{2}-\d{2}$/)) {
        throw new Error("Date must be in YYYY-MM-DD format");
      }
      const useProduct = body.type === "sale" && body.productId && (body.quantitySold ?? 0) > 0;
      if (!useProduct && (typeof body.amount !== "number" || isNaN(body.amount) || body.amount < 0)) {
        throw new Error("Amount is required and must be 0 or greater");
      }
      const optimistic: LedgerEntry = {
        id: "pending-" + Date.now(),
        businessId: body.businessId,
        type: body.type,
        amount: body.amount,
        currency: body.currency,
        description: body.description ?? "",
        category: body.category ?? "",
        date: body.date,
        createdAt: new Date().toISOString(),
      };
      const result = await offlineMutation<LedgerEntry>(
        "/api/v1/ledger/entries",
        "POST",
        body,
        token,
        optimistic
      );
      const entry = result.data;
      if (entry?.id) {
        await patchLedgerCaches(body.businessId, entry);
      }
      return result;
    },

    getBalance: (businessId: string) => {
      if (!businessId?.trim()) {
        return Promise.reject(new Error("Business ID is required"));
      }
      return apiGetWithOfflineCache<BalanceResult>(
        "/api/v1/ledger/balance",
        listCacheKey(CACHE_KEYS.LEDGER_BALANCE, businessId, { businessId }),
        { token: token ?? undefined, params: { businessId } }
      );
    },
  };
}
