"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/contexts/locale-context";
import { getAllQueued } from "@/lib/offline-queue";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const { t } = useLocale();

  const refreshCount = async () => {
    try {
      const items = await getAllQueued();
      setQueuedCount(items.length);
      return items.length;
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    setOffline(!navigator.onLine);
    refreshCount();

    const onOffline = () => {
      setOffline(true);
      refreshCount();
    };
    const onOnline = async () => {
      setOffline(false);
      const count = await refreshCount();
      if (count > 0) {
        setSyncing(true);
        // poll until queue drains (sync manager handles actual drain)
        const interval = setInterval(async () => {
          const remaining = await refreshCount();
          if (remaining === 0) {
            clearInterval(interval);
            setSyncing(false);
          }
        }, 2000);
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!offline && !syncing) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed bottom-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white shadow-lg ${
        offline ? "bg-amber-500" : "bg-green-600"
      }`}
    >
      {offline ? (
        <>
          <span aria-hidden="true">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          </span>
          {t("common.offline")}
          {queuedCount > 0 && (
            <span>
              {" — "}
              {queuedCount} action{queuedCount !== 1 ? "s" : ""} will sync
              when back online
            </span>
          )}
        </>
      ) : (
        <>
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Syncing {queuedCount} pending action
          {queuedCount !== 1 ? "s" : ""}…
        </>
      )}
    </div>
  );
}
