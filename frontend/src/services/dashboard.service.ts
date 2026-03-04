import { api } from "@/lib/api-client";

export interface DashboardSummary {
  balance: number;
  currency: string;
  ledgerEntriesCount: number;
  invoicesCount: number;
  customersCount: number;
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
