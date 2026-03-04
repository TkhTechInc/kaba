import {
  apiGet,
  apiPost,
  apiPatch,
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
    updateBusinessTier: (businessId: string, tier: string) =>
      apiPatch<{ success: boolean; data: AdminBusiness }>(
        `${ADMIN}/businesses/${encodeURIComponent(businessId)}/tier`,
        { tier },
        opts()
      ),
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
  };
}
