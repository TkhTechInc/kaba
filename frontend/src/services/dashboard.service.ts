import {
  apiGetWithOfflineCache,
} from "@/lib/api-client";
import { CACHE_KEYS, deleteCachedByPrefix, listCacheKey } from "@/lib/offline-cache";
import { setLastSyncedAt } from "@/services/mobile-sync.service";

/** Mobile home response – single consolidated call for dashboard. */
export interface MobileHomeData {
  dashboard: DashboardSummary;
  weeklyProfit: WeeksProfitData;
  paymentsOverview: PaymentsOverviewData;
  activityByType: ActivityByTypeData[];
  recentLedger: { items: Array<{ id: string; type: string; amount: number; currency: string; description: string; category: string; date: string; createdAt: string }>; total: number };
  pendingInvoices: { items: Array<{ id: string; amount: number; currency: string; dueDate: string; status: string }>; total: number };
  debts: { items: Array<{ id: string; debtorName: string; amount: number; currency: string; dueDate: string; status: string }>; total: number };
}

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

/** Single consolidated dashboard call – replaces 4+ separate calls on load. */
export async function getMobileHome(
  businessId: string,
  token: string | null
): Promise<MobileHomeData | null> {
  if (!businessId?.trim()) return null;
  try {
    const res = await apiGetWithOfflineCache<MobileHomeData>(
      "/api/v1/mobile/home",
      listCacheKey(CACHE_KEYS.DASHBOARD, businessId, { businessId, type: "home" }),
      { token: token ?? undefined, params: { businessId } }
    );
    const data = res.data ?? null;
    if (data && typeof navigator !== "undefined" && navigator.onLine) {
      setLastSyncedAt(businessId, new Date().toISOString()).catch(() => {});
    }
    return data;
  } catch {
    return null;
  }
}

/** Invalidate all cached data for a business (dashboard, debts, invoices, customers, ledger, products). Call after seeding. */
export async function invalidateBusinessCache(businessId: string): Promise<void> {
  const prefixes = [
    CACHE_KEYS.DASHBOARD,
    CACHE_KEYS.DEBTS,
    CACHE_KEYS.INVOICES,
    CACHE_KEYS.INVOICES_PENDING_APPROVAL,
    CACHE_KEYS.CUSTOMERS,
    CACHE_KEYS.LEDGER_ENTRIES,
    CACHE_KEYS.LEDGER_BALANCE,
    CACHE_KEYS.PRODUCTS,
    "sync:meta",
  ];
  for (const p of prefixes) {
    await deleteCachedByPrefix(`${p}:${businessId}`);
  }
}

export async function getDashboardSummary(
  businessId: string,
  token: string | null
): Promise<DashboardSummary | null> {
  if (!businessId?.trim()) return null;
  try {
    const res = await apiGetWithOfflineCache<DashboardSummary>(
      "/api/v1/dashboard/summary",
      listCacheKey(CACHE_KEYS.DASHBOARD, businessId, {
        businessId,
        type: "summary",
      }),
      { token: token ?? undefined, params: { businessId } }
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
    const res = await apiGetWithOfflineCache<PaymentsOverviewData>(
      "/api/v1/dashboard/payments-overview",
      listCacheKey(CACHE_KEYS.DASHBOARD, businessId, {
        businessId,
        type: "payments",
        timeFrame,
      }),
      {
        token: token ?? undefined,
        params: { businessId, timeFrame },
      }
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
    const res = await apiGetWithOfflineCache<WeeksProfitData>(
      "/api/v1/dashboard/weeks-profit",
      listCacheKey(CACHE_KEYS.DASHBOARD, businessId, {
        businessId,
        type: "weeks-profit",
        timeFrame,
      }),
      {
        token: token ?? undefined,
        params: { businessId, timeFrame },
      }
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
    const res = await apiGetWithOfflineCache<ActivityByTypeData[]>(
      "/api/v1/dashboard/activity-by-type",
      listCacheKey(CACHE_KEYS.DASHBOARD, businessId, {
        businessId,
        type: "activity",
        timeFrame,
      }),
      {
        token: token ?? undefined,
        params: { businessId, timeFrame },
      }
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}
