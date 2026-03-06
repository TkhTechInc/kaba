"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { getAllQueued, removeQueued, incrementRetry } from "@/lib/offline-queue";

const MAX_RETRIES = 5;

export function useSyncManager(token: string | null) {
  const syncingRef = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? navigator.onLine : true
  );

  const refreshPendingCount = useCallback(async () => {
    try {
      const items = await getAllQueued();
      setPendingCount(items.length);
    } catch {
      // ignore
    }
  }, []);

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
      refreshPendingCount();
    }
  }, [token, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
    drainQueue();

    const handleOnline = () => {
      setIsOnline(true);
      drainQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshPendingCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_REQUESTED") drainQueue();
    };
    navigator.serviceWorker?.addEventListener("message", handler);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handler);
    };
  }, [drainQueue, refreshPendingCount]);

  return { drainQueue, pendingCount, isOnline };
}
