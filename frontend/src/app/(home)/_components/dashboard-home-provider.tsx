"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { getMobileHome, type MobileHomeData } from "@/services/dashboard.service";
import { setLastSyncedAt } from "@/services/mobile-sync.service";
import { useDashboardRefresh } from "./dashboard-refresh-provider";

const DashboardHomeContext = createContext<{
  data: MobileHomeData | null;
  loading: boolean;
  error: boolean;
} | null>(null);

export function useDashboardHome() {
  const ctx = useContext(DashboardHomeContext);
  return ctx ?? { data: null, loading: false, error: false };
}

export function DashboardHomeProvider({ children }: { children: ReactNode }) {
  const { businessId, token } = useAuth();
  const { refreshTrigger } = useDashboardRefresh();
  const [data, setData] = useState<MobileHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchHome = useCallback(async () => {
    if (!businessId || !token) {
      setData(null);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const result = await getMobileHome(businessId, token);
      setData(result);
      if (result) {
        setLastSyncedAt(businessId, new Date().toISOString()).catch(() => {});
      }
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  useEffect(() => {
    fetchHome();
  }, [businessId, token, refreshTrigger, fetchHome]);

  return (
    <DashboardHomeContext.Provider value={{ data, loading, error }}>
      {children}
    </DashboardHomeContext.Provider>
  );
}
