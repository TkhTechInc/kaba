import { api } from "@/lib/api-client";

export interface MobileMoneyReconResult {
  entry: {
    id: string;
    businessId: string;
    type: "sale" | "expense";
    amount: number;
    currency: string;
    description: string;
    category: string;
    date: string;
    createdAt: string;
  };
  parsed: {
    amount: number;
    currency: string;
    date: string;
    type: "credit" | "debit";
    reference?: string;
    description?: string;
  };
}

export function createReconciliationApi(token: string | null) {
  return {
    reconcileMobileMoney: (businessId: string, smsText: string) =>
      api.post<MobileMoneyReconResult>("/api/v1/reconciliation/mobile-money", {
        businessId,
        smsText,
      }, { token: token ?? undefined }),
  };
}
