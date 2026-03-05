import { api } from "@/lib/api-client";

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

    createEntry: (body: CreateLedgerEntryInput) =>
      api.post<LedgerEntry>("/api/v1/ledger/entries", body, { token: token ?? undefined }),

    getBalance: (businessId: string) =>
      api.get<BalanceResult>("/api/v1/ledger/balance", {
        token: token ?? undefined,
        params: { businessId },
      }),
  };
}
