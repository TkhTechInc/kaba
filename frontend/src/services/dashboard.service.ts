import { api } from "@/lib/api-client";

export interface DashboardSummary {
  balance: number;
  currency: string;
  ledgerEntriesCount: number;
  invoicesCount: number;
  customersCount: number;
}

export interface PaymentsOverviewData {
  received: Array<{ x: string; y: number }>;
  due: Array<{ x: string; y: number }>;
  currency: string;
}

export interface WeeksProfitData {
  sales: Array<{ x: string; y: number }>;
  revenue: Array<{ x: string; y: number }>;
}

export interface ActivityByTypeData {
  name: string;
  amount: number;
}

export async function getDashboardSummary(
  businessId: string,
  token: string | null
): Promise<DashboardSummary | null> {
  if (!businessId?.trim()) return null;
  try {
    const res = await api.get<DashboardSummary>(
      `/api/v1/dashboard/summary?businessId=${encodeURIComponent(businessId)}`,
      { token: token ?? undefined }
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function getPaymentsOverview(
  businessId: string,
  token: string | null,
  timeFrame: "monthly" | "yearly" = "monthly"
): Promise<PaymentsOverviewData | null> {
  if (!businessId?.trim()) return null;
  try {
    const res = await api.get<PaymentsOverviewData>(
      `/api/v1/dashboard/payments-overview?businessId=${encodeURIComponent(businessId)}&timeFrame=${encodeURIComponent(timeFrame)}`,
      { token: token ?? undefined }
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function getWeeksProfit(
  businessId: string,
  token: string | null,
  timeFrame: "this week" | "last week" = "this week"
): Promise<WeeksProfitData | null> {
  if (!businessId?.trim()) return null;
  try {
    const res = await api.get<WeeksProfitData>(
      `/api/v1/dashboard/weeks-profit?businessId=${encodeURIComponent(businessId)}&timeFrame=${encodeURIComponent(timeFrame)}`,
      { token: token ?? undefined }
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function getActivityByType(
  businessId: string,
  token: string | null,
  timeFrame: "monthly" | "yearly" = "monthly"
): Promise<ActivityByTypeData[] | null> {
  if (!businessId?.trim()) return null;
  try {
    const res = await api.get<ActivityByTypeData[]>(
      `/api/v1/dashboard/activity-by-type?businessId=${encodeURIComponent(businessId)}&timeFrame=${encodeURIComponent(timeFrame)}`,
      { token: token ?? undefined }
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}
