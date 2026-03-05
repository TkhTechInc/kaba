import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { offlineMutation } from "@/lib/offline-api";

export interface ApiKey {
  id: string;
  businessId: string;
  name: string;
  scopes: string[];
  keyPrefix: string; // last 4 chars shown
  createdAt: string;
  lastUsedAt?: string;
}

export interface CreateApiKeyInput {
  businessId: string;
  name: string;
  scopes: string[];
}

export interface CreateApiKeyResult {
  key: ApiKey;
  rawKey: string; // shown once only
}

export const API_KEY_SCOPES = [
  "ledger:read", "ledger:write",
  "invoices:read", "invoices:write",
  "receipts:read", "receipts:write",
  "reports:read",
  "inventory:read", "inventory:write",
] as const;

function syntheticQueuedKey(input: CreateApiKeyInput): CreateApiKeyResult {
  return {
    key: {
      id: "queued",
      businessId: input.businessId,
      name: input.name,
      scopes: input.scopes,
      keyPrefix: "....",
      createdAt: new Date().toISOString(),
    },
    rawKey: "[Queued — will sync when online]",
  };
}

export function createApiKeysApi(token: string | null) {
  return {
    list: (businessId: string) =>
      apiGet<{ success: boolean; data: ApiKey[] }>(
        `/api/v1/api-keys?businessId=${encodeURIComponent(businessId)}`,
        { token: token ?? undefined }
      ),
    create: async (input: CreateApiKeyInput) => {
      const result = await offlineMutation<{ success: boolean; data: CreateApiKeyResult }>(
        "/api/v1/api-keys",
        "POST",
        input,
        token,
        { success: true, data: syntheticQueuedKey(input) }
      );
      return (result.data as { success: boolean; data: CreateApiKeyResult }) ?? { success: true, data: syntheticQueuedKey(input) };
    },
    revoke: async (id: string, businessId: string) => {
      const result = await offlineMutation<{ success: boolean }>(
        `/api/v1/api-keys/${id}?businessId=${encodeURIComponent(businessId)}`,
        "DELETE",
        {},
        token,
        { success: true }
      );
      return result.data as { success: boolean };
    },
  };
}
