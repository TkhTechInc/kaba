import { api } from "@/lib/api-client";
import { offlineMutation } from "@/lib/offline-api";

export interface PLReport {
  revenue?: number;
  expenses?: number;
  profit?: number;
  totalIncome?: number;
  totalExpenses?: number;
  netProfit?: number;
  currency: string;
  fromDate?: string;
  toDate?: string;
  period?: { start: string; end: string };
  byCategory?: { category: string; type: string; amount: number }[];
  items?: { description: string; amount: number; type: string }[];
}

export interface CashFlowSummary {
  openingBalance?: number;
  closingBalance?: number;
  totalInflows?: number;
  totalOutflows?: number;
  currency: string;
  fromDate?: string;
  toDate?: string;
  period?: { start: string; end: string };
  daily?: { date: string; inflows?: number; outflows?: number; inflow?: number; outflow?: number; balance?: number }[];
}

export function createReportsApi(token: string | null) {
  const params = (businessId: string, fromDate: string, toDate: string) =>
    `?businessId=${encodeURIComponent(businessId)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`;

  return {
    getPL: (businessId: string, fromDate: string, toDate: string) =>
      api.get<PLReport>(`/api/v1/reports/pl${params(businessId, fromDate, toDate)}`, {
        token: token ?? undefined,
      }),

    getCashFlow: (businessId: string, fromDate: string, toDate: string) =>
      api.get<CashFlowSummary>(`/api/v1/reports/cash-flow${params(businessId, fromDate, toDate)}`, {
        token: token ?? undefined,
      }),

    downloadPLPdf: async (businessId: string, fromDate: string, toDate: string) => {
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const url = `${base}/api/v1/reports/pl/pdf${params(businessId, fromDate, toDate)}`;
      const t = typeof window !== "undefined" ? localStorage.getItem("qb_auth_token") : null;
      const res = await fetch(url, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!res.ok) throw new Error("Failed to download PDF");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pl-${fromDate}-${toDate}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    },

    downloadCashFlowPdf: async (businessId: string, fromDate: string, toDate: string) => {
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const url = `${base}/api/v1/reports/cash-flow/pdf${params(businessId, fromDate, toDate)}`;
      const t = typeof window !== "undefined" ? localStorage.getItem("qb_auth_token") : null;
      const res = await fetch(url, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!res.ok) throw new Error("Failed to download PDF");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `cash-flow-${fromDate}-${toDate}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    },

    getConsolidatedPL: (businessId: string, organizationId: string, fromDate: string, toDate: string) =>
      api.get<{
        organizationId: string;
        period: { start: string; end: string };
        totalIncome: number;
        totalExpenses: number;
        netProfit: number;
        currency: string;
        branches: Array<{
          businessId: string;
          businessName?: string;
          report: PLReport;
        }>;
      }>(
        `/api/v1/reports/consolidated?businessId=${encodeURIComponent(businessId)}&organizationId=${encodeURIComponent(organizationId)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`,
        { token: token ?? undefined }
      ),

    getCreditScore: (businessId: string, customerId: string, fromDate: string, toDate: string) =>
      api.get<{
        customerId: string;
        trustScore: number;
        breakdown: {
          transactionFrequency: number;
          debtRepaymentRatio: number;
          volumeConsistency: number;
        };
        recommendation: 'approve' | 'review' | 'deny';
        period: { start: string; end: string };
        scoredAt: string;
      }>(
        `/api/v1/reports/credit-score?businessId=${encodeURIComponent(businessId)}&customerId=${encodeURIComponent(customerId)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`,
        { token: token ?? undefined }
      ),

    getLockedPeriods: (businessId: string) =>
      api.get<{ lockedPeriods: string[] }>(
        `/api/v1/ledger/locked-periods?businessId=${encodeURIComponent(businessId)}`,
        { token: token ?? undefined }
      ),

    lockPeriod: async (businessId: string, year: number, month: number) => {
      const period = `${year}-${String(month).padStart(2, "0")}`;
      const result = await offlineMutation<{ period: string; locked: boolean }>(
        "/api/v1/ledger/lock-period",
        "POST",
        { businessId, year, month },
        token,
        { period, locked: true }
      );
      return result.data;
    },
  };
}
