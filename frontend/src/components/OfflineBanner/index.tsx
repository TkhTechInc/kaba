"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/contexts/locale-context";
import { getAllQueued } from "@/lib/offline-queue";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const { t } = useLocale();

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!offline) return;
    getAllQueued().then((items) => setQueuedCount(items.length)).catch(() => {});
  }, [offline]);

  if (!offline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      <span aria-hidden="true">📶</span>
      {t("common.offline")}
      {queuedCount > 0 && (
        <span>
          {" — "}
          {queuedCount} action{queuedCount !== 1 ? "s" : ""} will sync when back online
        </span>
      )}
    </div>
  );
}
