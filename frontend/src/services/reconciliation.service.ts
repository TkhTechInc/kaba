import { offlineMutation } from "@/lib/offline-api";

export interface MatchedInvoiceInfo {
  id: string;
  number: string;
}

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
  /** Set when exactly one invoice matched and was auto-marked paid */
  matchedInvoice?: MatchedInvoiceInfo;
  /** Set when 2+ invoices match; user must choose (no auto-apply) */
  matchedInvoices?: MatchedInvoiceInfo[];
}

export function createReconciliationApi(token: string | null) {
  return {
    reconcileMobileMoney: async (businessId: string, smsText: string) => {
      const optimistic: MobileMoneyReconResult = {
        entry: {
          id: "pending-" + Date.now(),
          businessId,
          type: "sale",
          amount: 0,
          currency: "",
          description: "",
          category: "",
          date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
        },
        parsed: { amount: 0, currency: "", date: "", type: "credit" },
      };
      const result = await offlineMutation<MobileMoneyReconResult>(
        "/api/v1/reconciliation/mobile-money",
        "POST",
        { businessId, smsText },
        token,
        optimistic
      );
      return result.data;
    },
  };
}
