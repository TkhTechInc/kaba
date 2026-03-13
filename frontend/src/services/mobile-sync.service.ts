/**
 * Mobile sync service – pulls server changes since lastSync and merges into IndexedDB cache.
 * Used by PWA and native apps. Call on reconnect before draining the write queue.
 */

import { CACHE_KEYS, getCached, setCached, listCacheKey } from "@/lib/offline-cache";
import type { ApiResponse } from "@/lib/api-client";

const SYNC_META_PREFIX = "sync:meta:";
const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface MobileSyncResponse {
  syncedAt: string;
  ledgerEntries: Array<{ id: string; createdAt?: string; deletedAt?: string; [k: string]: unknown }>;
  invoices: Array<{ id: string; createdAt?: string; deletedAt?: string; [k: string]: unknown }>;
  customers: Array<{ id: string; createdAt?: string; deletedAt?: string; [k: string]: unknown }>;
  products: Array<{ id: string; createdAt?: string; deletedAt?: string; [k: string]: unknown }>;
  deletedIds: {
    ledgerEntries: string[];
    invoices: string[];
    customers: string[];
    products: string[];
  };
}

async function fetchSync(
  businessId: string,
  since: string,
  token: string | null
): Promise<MobileSyncResponse | null> {
  const url = `${getBaseUrl()}/api/v1/mobile/sync?businessId=${encodeURIComponent(businessId)}&since=${encodeURIComponent(since)}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

const sortByCreatedAt = <T extends { id: string; createdAt?: string }>(a: T, b: T) =>
  new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();

function mergeIntoListCache<T extends { id: string; createdAt?: string }>(
  cacheKey: string,
  syncItems: T[],
  deletedIds: string[]
): Promise<void> {
  return (async () => {
    const cached = await getCached<ApiResponse<{ items: T[]; total: number; page: number; limit: number }>>(cacheKey);
    if (!cached?.data) {
      if (syncItems.length === 0) return;
      const items = [...syncItems].sort(sortByCreatedAt);
      await setCached(cacheKey, {
        success: true,
        data: { items, total: items.length, page: 1, limit: 20 },
      } as ApiResponse<{ items: T[]; total: number; page: number; limit: number }>);
      return;
    }

    const byId = new Map<string, T>();
    for (const item of cached.data.items) {
      byId.set(item.id, item);
    }
    for (const item of syncItems) {
      byId.set(item.id, item);
    }
    for (const id of deletedIds) {
      byId.delete(id);
    }

    const items = Array.from(byId.values()).sort(sortByCreatedAt);

    await setCached(cacheKey, {
      ...cached,
      data: {
        ...cached.data,
        items,
        total: Math.max(items.length, cached.data.total),
      },
    });
  })();
}

/**
 * Run sync: fetch changes since lastSyncedAt, merge into cache, update lastSyncedAt.
 * Returns the new syncedAt or null on failure.
 */
export async function runMobileSync(
  businessId: string,
  token: string | null
): Promise<string | null> {
  if (!businessId?.trim()) return null;

  const metaKey = `${SYNC_META_PREFIX}${businessId}`;
  const meta = await getCached<{ lastSyncedAt: string }>(metaKey);
  const since = meta?.lastSyncedAt ?? new Date(0).toISOString();

  const data = await fetchSync(businessId, since, token);
  if (!data) return null;

  const ledgerKey = listCacheKey(CACHE_KEYS.LEDGER_ENTRIES, businessId, {
    businessId,
    page: "1",
    limit: "20",
  });
  const invoicesKey = listCacheKey(CACHE_KEYS.INVOICES, businessId, {
    businessId,
    page: "1",
    limit: "20",
  });
  const customersKey = listCacheKey(CACHE_KEYS.CUSTOMERS, businessId, {
    businessId,
    page: "1",
    limit: "20",
  });
  const productsKey = listCacheKey(CACHE_KEYS.PRODUCTS, businessId, {
    businessId,
    page: "1",
    limit: "20",
  });

  await Promise.all([
    mergeIntoListCache(ledgerKey, data.ledgerEntries as Array<{ id: string; createdAt?: string }>, data.deletedIds.ledgerEntries),
    mergeIntoListCache(invoicesKey, data.invoices as Array<{ id: string; createdAt?: string }>, data.deletedIds.invoices),
    mergeIntoListCache(customersKey, data.customers as Array<{ id: string; createdAt?: string }>, data.deletedIds.customers),
    mergeIntoListCache(productsKey, data.products as Array<{ id: string; createdAt?: string }>, data.deletedIds.products),
  ]);

  await setCached(metaKey, { lastSyncedAt: data.syncedAt });
  return data.syncedAt;
}

/** Call after successfully fetching fresh data (e.g. mobile home) to bootstrap sync state. */
export async function setLastSyncedAt(businessId: string, at: string): Promise<void> {
  if (!businessId?.trim()) return;
  const metaKey = `${SYNC_META_PREFIX}${businessId}`;
  await setCached(metaKey, { lastSyncedAt: at });
}
