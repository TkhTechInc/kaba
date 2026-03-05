import { enqueueRequest } from "./offline-queue";

function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Wraps a mutation fetch. If offline, queues the request and resolves with
 * a synthetic optimistic response so the UI can continue.
 */
export async function offlineMutation<T = unknown>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
  token: string | null,
  optimisticResponse?: T
): Promise<{ data: T; queued: boolean }> {
  const fullUrl = url.startsWith("http")
    ? url
    : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}${url}`;

  if (typeof window !== "undefined" && navigator && !navigator.onLine) {
    await enqueueRequest({
      url: fullUrl,
      method,
      body: JSON.stringify(body),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      idempotencyKey: generateIdempotencyKey(),
    });
    // Trigger background sync so the SW can wake the drain when connectivity restores
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then((reg) => (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync?.register('kaba-sync'))
        .catch(() => {});
    }
    return { data: optimisticResponse as T, queued: true };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  const data = await res.json();
  return { data, queued: false };
}
