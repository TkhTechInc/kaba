/** API key scopes align with Permission type. API keys use scopes, not role. */
export type ApiKeyScope =
  | 'ledger:read'
  | 'ledger:write'
  | 'invoices:read'
  | 'invoices:write'
  | 'reports:read'
  | 'reports:write'
  | 'receipts:read'
  | 'receipts:write'
  | 'ai:read'
  | 'tax:read'
  | 'features:read'
  | 'webhooks:read'
  | 'webhooks:write'
  | 'api_keys:read'
  | 'api_keys:write';

export interface ApiKey {
  id: string;
  businessId: string;
  name: string;
  keyHash: string;
  keyPrefix: string; // e.g. qb_live_xxxx (first 12 chars) for display
  scopes: ApiKeyScope[];
  lastUsedAt?: string;
  createdAt: string;
}

export interface CreateApiKeyInput {
  businessId: string;
  name: string;
  scopes: ApiKeyScope[];
  isTest?: boolean;
}

export interface ApiKeyValidationResult {
  businessId: string;
  scopes: ApiKeyScope[];
  keyId: string;
}
