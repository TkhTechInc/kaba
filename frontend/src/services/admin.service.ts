import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  type RequestConfig,
} from "@/lib/api-client";

const ADMIN = "/api/v1/admin";

function withToken(token: string | null): RequestConfig {
  return { token: token ?? undefined };
}

export interface AdminSummary {
  businessesCount: number;
  ledgerEntriesCount: number;
  invoicesCount: number;
  recentActivityCount: number;
  timestamp: string;
}

export interface AdminHealth {
  status: "ok" | "degraded";
  timestamp: string;
  dynamodb: { ok: boolean; latencyMs?: number };
  s3?: { configured: boolean; ok?: boolean; latencyMs?: number };
}

export interface AdminReceiptsStatus {
  configured: boolean;
  bucket?: string;
  region?: string;
  status?: "ok" | "unavailable";
}

export interface AdminMetrics {
  businessesCount: number;
  ledgerEntriesCount: number;
  invoicesCount: number;
  note: string;
}

export interface AdminActivityItem {
  id: string;
  businessId: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  category: string;
  date: string;
  createdAt: string;
}

export interface AdminActivity {
  items: AdminActivityItem[];
  lastEvaluatedKey?: Record<string, unknown>;
}

export interface AuditLogItem {
  id: string;
  entityType: string;
  entityId: string;
  businessId: string;
  action: string;
  userId?: string;
  changes?: Record<string, unknown>;
  timestamp?: string;
  createdAt?: string;
}

export interface AdminAuditLogs {
  items: AuditLogItem[];
  lastEvaluatedKey?: Record<string, unknown>;
}

export interface LeakageAnomaly {
  userId: string;
  hourWindow: string;
  invoiceCount: number;
  reconciliationCount: number;
  gap: number;
  severity: "low" | "medium" | "high";
}

export interface LeakageReport {
  anomalies: LeakageAnomaly[];
}

export interface AdminAIResponse {
  answer: string;
}

export interface FeatureConfig {
  enabled: boolean;
  tiers: string[];
  limits?: Record<string, number>;
}

export interface AdminBusiness {
  id: string;
  tier: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUser {
  id: string;
  phone?: string;
  email?: string;
  role: string;
  createdAt?: string;
}

export interface AdminDebtBucket {
  label: string;
  amount: number;
  count: number;
}

export interface AdminDebtItem {
  businessId: string;
  businessName?: string;
  totalCount: number;
  totalAmount: number;
  currency: string;
  buckets: AdminDebtBucket[];
}

export interface AdminDebtsSummary {
  items: AdminDebtItem[];
  lastEvaluatedKey?: Record<string, unknown>;
  platformTotalCount: number;
  platformTotalAmount: number;
}

export interface AdminUsageItem {
  businessId: string;
  businessName?: string;
  tier: string;
  aiQueryCount: number;
  aiQueryLimit?: number;
  mobileMoneyReconCount: number;
  mobileMoneyReconLimit?: number;
}

export interface AdminUsageSummary {
  items: AdminUsageItem[];
  lastEvaluatedKey?: Record<string, unknown>;
  month: string;
}

export function createAdminApi(token: string | null) {
  const opts = () => withToken(token);

  return {
    getSummary: () =>
      apiGet<{ success: boolean; data: AdminSummary }>(
        `${ADMIN}/summary`,
        opts()
      ),
    getHealth: () =>
      apiGet<AdminHealth>(`${ADMIN}/health`, opts()),
    getReceiptsStatus: () =>
      apiGet<AdminReceiptsStatus>(`${ADMIN}/receipts/status`, opts()),
    getMetrics: () =>
      apiGet<{ success: boolean; data: AdminMetrics }>(
        `${ADMIN}/metrics`,
        opts()
      ),
    getActivity: (params?: { limit?: number; lastEvaluatedKey?: string }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.lastEvaluatedKey)
        q.set("lastEvaluatedKey", params.lastEvaluatedKey);
      const query = q.toString();
      return apiGet<AdminActivity>(
        `${ADMIN}/activity${query ? `?${query}` : ""}`,
        opts()
      );
    },
    getLeakageReport: (params: {
      businessId: string;
      from?: string;
      to?: string;
    }) => {
      const q = new URLSearchParams();
      q.set("businessId", params.businessId);
      if (params.from) q.set("from", params.from);
      if (params.to) q.set("to", params.to);
      return apiGet<{ success: boolean; data: LeakageReport }>(
        `${ADMIN}/leakage-report?${q.toString()}`,
        opts()
      );
    },
    getAuditLogs: (params?: {
      businessId?: string;
      from?: string;
      to?: string;
      limit?: number;
      lastEvaluatedKey?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.businessId) q.set("businessId", params.businessId);
      if (params?.from) q.set("from", params.from);
      if (params?.to) q.set("to", params.to);
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.lastEvaluatedKey)
        q.set("lastEvaluatedKey", params.lastEvaluatedKey);
      const query = q.toString();
      return apiGet<{ success: boolean; data: AdminAuditLogs }>(
        `${ADMIN}/audit-logs${query ? `?${query}` : ""}`,
        opts()
      );
    },
    aiQuery: (query: string) =>
      apiPost<{ success: boolean; data: AdminAIResponse }>(
        `${ADMIN}/ai/query`,
        { query },
        opts()
      ),
    getFeatures: () =>
      apiGet<{ success: boolean; data: Record<string, FeatureConfig> }>(
        `${ADMIN}/features`,
        opts()
      ),
    updateFeature: (
      key: string,
      config: Partial<FeatureConfig>
    ) =>
      apiPatch<{ success: boolean; data: FeatureConfig }>(
        `${ADMIN}/features/${encodeURIComponent(key)}`,
        config,
        opts()
      ),
    getBusinesses: (params?: { limit?: number; lastEvaluatedKey?: string }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.lastEvaluatedKey)
        q.set("lastEvaluatedKey", params.lastEvaluatedKey);
      const query = q.toString();
      return apiGet<{
        success: boolean;
        data?: { items: AdminBusiness[]; lastEvaluatedKey?: Record<string, unknown> };
      }>(`${ADMIN}/businesses${query ? `?${query}` : ""}`, opts());
    },
    getDebtsSummary: (params?: { limit?: number; lastEvaluatedKey?: string }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.lastEvaluatedKey)
        q.set("lastEvaluatedKey", params.lastEvaluatedKey);
      const query = q.toString();
      return apiGet<{
        success: boolean;
        data: AdminDebtsSummary;
      }>(`${ADMIN}/debts/summary${query ? `?${query}` : ""}`, opts());
    },
    getUsageSummary: (params?: {
      limit?: number;
      lastEvaluatedKey?: string;
      month?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.lastEvaluatedKey)
        q.set("lastEvaluatedKey", params.lastEvaluatedKey);
      if (params?.month) q.set("month", params.month);
      const query = q.toString();
      return apiGet<{
        success: boolean;
        data: AdminUsageSummary;
      }>(`${ADMIN}/usage/summary${query ? `?${query}` : ""}`, opts());
    },
    updateBusinessTier: (businessId: string, tier: string) =>
      apiPatch<{ success: boolean; data: AdminBusiness }>(
        `${ADMIN}/businesses/${encodeURIComponent(businessId)}/tier`,
        { tier },
        opts()
      ),
    getUsers: (params?: { limit?: number; lastEvaluatedKey?: string }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.lastEvaluatedKey)
        q.set("lastEvaluatedKey", params.lastEvaluatedKey);
      const query = q.toString();
      return apiGet<{
        success: boolean;
        data: { items: AdminUser[]; lastEvaluatedKey?: Record<string, unknown> };
      }>(`${ADMIN}/users${query ? `?${query}` : ""}`, opts());
    },
    createUserByPhone: (phone: string, role?: "admin" | "user") =>
      apiPost<{ success: boolean; data: { id: string; phone: string; role?: string } }>(
        `${ADMIN}/users/phone`,
        { phone, role },
        opts()
      ),
    updateUserRole: (userId: string, role: "admin" | "user") =>
      apiPatch<{ success: boolean; data: { id: string; role: string } }>(
        `${ADMIN}/users/${encodeURIComponent(userId)}/role`,
        { role },
        opts()
      ),
    deleteUser: (userId: string) =>
      apiDelete<{ success: boolean; message?: string }>(
        `${ADMIN}/users/${encodeURIComponent(userId)}`,
        opts()
      ),
  };
}
