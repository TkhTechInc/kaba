import { api } from "@/lib/api-client";
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

export function createLedgerApi(token: string | null) {
  return {
    listEntries: (businessId: string, page = 1, limit = 20) =>
      api.get<ListEntriesResult>("/api/v1/ledger/entries", {
        token: token ?? undefined,
        params: { businessId, page: String(page), limit: String(limit) },
      }),

    createEntry: async (body: CreateLedgerEntryInput) => {
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
      return result.data;
    },

    getBalance: (businessId: string) =>
      api.get<BalanceResult>("/api/v1/ledger/balance", {
        token: token ?? undefined,
        params: { businessId },
      }),
  };
}
