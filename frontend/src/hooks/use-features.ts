"use client";

import { apiGet } from "@/lib/api-client";
import { useAuthOptional } from "@/contexts/auth-context";
import {
  getCached as getOfflineCached,
  setCached as setOfflineCached,
  deleteCached as deleteOfflineCached,
  featuresCacheKey,
} from "@/lib/offline-cache";
import { useCallback, useEffect, useMemo, useState } from "react";

export type Tier = "free" | "starter" | "pro" | "enterprise";

export type FeaturesResponse = {
  success: boolean;
  data: {
    tier: Tier;
    onboardingComplete?: boolean;
    currency?: string;
    countryCode?: string;
    enabled: Record<string, boolean>;
    limits: Record<string, number | undefined>;
  };
};

const MEM_CACHE = new Map<string, { data: FeaturesResponse["data"]; at: number }>();
const CACHE_TTL_MS = 60_000;

function getMemCached(businessId: string): FeaturesResponse["data"] | null {
  const entry = MEM_CACHE.get(businessId);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    MEM_CACHE.delete(businessId);
    return null;
  }
  return entry.data;
}

function setMemCached(businessId: string, data: FeaturesResponse["data"]) {
  MEM_CACHE.set(businessId, { data, at: Date.now() });
}

function setBothCaches(businessId: string, data: FeaturesResponse["data"]) {
  setMemCached(businessId, data);
  setOfflineCached(featuresCacheKey(businessId), data);
}

/** Invalidate cached features for a business (e.g. after tier change). */
export function invalidateFeaturesCache(businessId: string) {
  MEM_CACHE.delete(businessId);
  deleteOfflineCached(featuresCacheKey(businessId));
}

/** businessIds that recently 403'd — skip auto-fetch until explicit refetch */
const PERM_ERROR_CACHE = new Set<string>();

export function useFeatures(businessId: string | null) {
  const auth = useAuthOptional();
  const accessToken = auth?.token ?? null;
  // Initialize from in-memory cache if available to avoid "not available on your plan" flash on first render
  const initialCached = businessId?.trim() ? getMemCached(businessId) : null;
  const [data, setData] = useState<FeaturesResponse["data"] | null>(initialCached);
  const [loading, setLoading] = useState(!initialCached && !!businessId?.trim());
  const [error, setError] = useState<Error | null>(null);

  const fetchFeatures = useCallback(async () => {
    if (!businessId?.trim()) {
      setData(null);
      return;
    }

    // Clear permission error flag on explicit refetch so the user can retry
    PERM_ERROR_CACHE.delete(businessId);

    const memCached = getMemCached(businessId);
    if (memCached) {
      setData(memCached);
      return;
    }

    if (!navigator.onLine) {
      const offlineCached = await getOfflineCached<FeaturesResponse["data"]>(
        featuresCacheKey(businessId)
      );
      setData(offlineCached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<FeaturesResponse>(
        `/api/v1/features?businessId=${encodeURIComponent(businessId)}`,
        { token: accessToken ?? undefined }
      );
      if (res.success && res.data) {
        setBothCaches(businessId, res.data);
        setData(res.data);
      } else {
        setData(null);
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (err.message === "Forbidden") {
        // 403 — don't retry automatically, don't thrash the backend
        PERM_ERROR_CACHE.add(businessId);
      }
      const offlineCached = await getOfflineCached<FeaturesResponse["data"]>(
        featuresCacheKey(businessId)
      );
      setData(offlineCached ?? null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [businessId, accessToken]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!businessId?.trim()) {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
        return;
      }
      // Skip auto-fetch if a recent 403 occurred — wait for explicit refetch
      if (PERM_ERROR_CACHE.has(businessId)) {
        if (!cancelled) setLoading(false);
        return;
      }
      const memCached = getMemCached(businessId);
      if (memCached) {
        if (!cancelled) {
          setData(memCached);
          setLoading(false);
        }
        return;
      }
      if (!navigator.onLine) {
        const offlineCached = await getOfflineCached<FeaturesResponse["data"]>(
          featuresCacheKey(businessId)
        );
        if (!cancelled) {
          setData(offlineCached ?? null);
          setLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await apiGet<FeaturesResponse>(
          `/api/v1/features?businessId=${encodeURIComponent(businessId)}`,
          { token: accessToken ?? undefined }
        );
        if (!cancelled) {
          if (res.success && res.data) {
            setBothCaches(businessId, res.data);
            setData(res.data);
          } else {
            setData(null);
          }
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        if (err.message === "Forbidden") {
          PERM_ERROR_CACHE.add(businessId);
        }
        const offlineCached = await getOfflineCached<FeaturesResponse["data"]>(
          featuresCacheKey(businessId)
        );
        if (!cancelled) {
          setData(offlineCached ?? null);
          setError(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [businessId, accessToken]);

  const isEnabled = useCallback(
    (key: string): boolean => {
      if (!data?.enabled) return false;
      return Boolean(data.enabled[key]);
    },
    [data]
  );

  const getLimit = useCallback(
    (key: string): number | undefined => {
      if (!data?.limits) return undefined;
      return data.limits[key];
    },
    [data]
  );

  return useMemo(
    () => ({
      tier: data?.tier ?? null,
      onboardingComplete: data?.onboardingComplete ?? false,
      /** null while loading; "NGN" only when loaded but business has no currency set */
      currency: data ? (data.currency ?? "NGN") : null,
      /** ISO 3166-1 alpha-2 country code (e.g. NG, BJ, GH) from onboarding */
      countryCode: data?.countryCode ?? null,
      enabled: data?.enabled ?? {},
      limits: data?.limits ?? {},
      isEnabled,
      getLimit,
      loading,
      error,
      refetch: fetchFeatures,
    }),
    [data, isEnabled, getLimit, loading, error, fetchFeatures]
  );
}
