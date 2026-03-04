import { api } from "@/lib/api-client";

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
  };
}
