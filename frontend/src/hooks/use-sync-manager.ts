"use client";

import { useEffect, useCallback, useRef } from "react";
import { getAllQueued, removeQueued, incrementRetry } from "@/lib/offline-queue";

const MAX_RETRIES = 5;

export function useSyncManager(token: string | null) {
  const syncingRef = useRef(false);

  const drainQueue = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    try {
      const items = await getAllQueued();
      for (const item of items) {
        if (item.retries >= MAX_RETRIES) {
          await removeQueued(item.id!);
          continue;
        }
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...item.headers,
          };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          if (item.idempotencyKey) headers["X-Idempotency-Key"] = item.idempotencyKey;
          const res = await fetch(item.url, {
            method: item.method,
            headers,
            body: item.body,
          });
          if (res.ok) {
            await removeQueued(item.id!);
          } else {
            await incrementRetry(item.id!);
          }
        } catch {
          await incrementRetry(item.id!);
        }
      }
    } finally {
      syncingRef.current = false;
    }
  }, [token]);

  useEffect(() => {
    // Drain on mount and on reconnect
    drainQueue();
    window.addEventListener("online", drainQueue);

    // Also listen for service worker sync message
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_REQUESTED") drainQueue();
    };
    navigator.serviceWorker?.addEventListener("message", handler);

    return () => {
      window.removeEventListener("online", drainQueue);
      navigator.serviceWorker?.removeEventListener("message", handler);
    };
  }, [drainQueue]);

  return { drainQueue };
}
