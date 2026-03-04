"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/contexts/locale-context";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
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

  if (!offline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      <span aria-hidden="true">📶</span>
      {t("common.offline")}
    </div>
  );
}
