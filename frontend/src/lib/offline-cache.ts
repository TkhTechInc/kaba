/**
 * Local cache for API responses. Used when offline to serve previously fetched data.
 * Persists in IndexedDB so it survives page reloads.
 */

const DB_NAME = "kaba-offline-cache";
const STORE = "cache";
const DB_VERSION = 1;

const CACHE_KEYS = {
  PREFERENCES: "preferences",
  FEATURES: "features",
  DEBTS: "debts",
  INVOICES: "invoices",
  INVOICES_PENDING_APPROVAL: "invoices_pending",
  LEDGER_ENTRIES: "ledger_entries",
  LEDGER_BALANCE: "ledger_balance",
  CUSTOMERS: "customers",
  PRODUCTS: "products",
  BUSINESSES: "businesses",
  DASHBOARD: "dashboard",
} as const;

/** Build cache key for features by businessId. */
export function featuresCacheKey(businessId: string): string {
  return `${CACHE_KEYS.FEATURES}:${businessId}`;
}

/** Build cache key for list endpoints. */
export function listCacheKey(
  resource: string,
  businessId: string,
  params?: Record<string, string>
): string {
  const parts = [resource, businessId];
  if (params) {
    const sorted = Object.keys(params).sort();
    for (const k of sorted) {
      if (params[k] != null && params[k] !== "") parts.push(`${k}=${params[k]}`);
    }
  }
  return parts.join(":");
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCached<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => {
      const row = req.result as { key: string; value: T; updatedAt: number } | undefined;
      resolve(row?.value ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function setCached<T>(key: string, value: T): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ key, value, updatedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteCached(key: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Delete all cached entries whose key starts with prefix. Used to invalidate data after seeding. */
export async function deleteCachedByPrefix(prefix: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      const keys = req.result as string[];
      const toDelete = keys.filter((k) => k.startsWith(prefix));
      toDelete.forEach((k) => store.delete(k));
      tx.oncomplete = () => resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export { CACHE_KEYS };
