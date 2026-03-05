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
} as const;

/** Build cache key for features by businessId. */
export function featuresCacheKey(businessId: string): string {
  return `${CACHE_KEYS.FEATURES}:${businessId}`;
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

export { CACHE_KEYS };
