"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { invalidateBusinessCache } from "@/services/dashboard.service";

const DashboardRefreshContext = createContext<{
  refreshTrigger: number;
  refresh: () => Promise<void>;
} | null>(null);

export function useDashboardRefresh() {
  const ctx = useContext(DashboardRefreshContext);
  return ctx ?? { refreshTrigger: 0, refresh: async () => {} };
}

export function DashboardRefreshProvider({ children }: { children: ReactNode }) {
  const { businessId } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = useCallback(async () => {
    if (!businessId) return;
    await invalidateBusinessCache(businessId);
    setRefreshTrigger((t) => t + 1);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        invalidateBusinessCache(businessId).then(() => {
          setRefreshTrigger((t) => t + 1);
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [businessId]);

  return (
    <DashboardRefreshContext.Provider value={{ refreshTrigger, refresh }}>
      {children}
    </DashboardRefreshContext.Provider>
  );
}
