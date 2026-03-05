"use client";

import { apiGet } from "@/lib/api-client";
import { useAuthOptional } from "@/contexts/auth-context";
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

const CACHE = new Map<string, { data: FeaturesResponse["data"]; at: number }>();
const CACHE_TTL_MS = 60_000;

function getCached(businessId: string): FeaturesResponse["data"] | null {
  const entry = CACHE.get(businessId);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    CACHE.delete(businessId);
    return null;
  }
  return entry.data;
}

function setCached(businessId: string, data: FeaturesResponse["data"]) {
  CACHE.set(businessId, { data, at: Date.now() });
}

/** Invalidate cached features for a business (e.g. after tier change). */
export function invalidateFeaturesCache(businessId: string) {
  CACHE.delete(businessId);
}

export function useFeatures(businessId: string | null) {
  const auth = useAuthOptional();
  const accessToken = auth?.token ?? null;
  const [data, setData] = useState<FeaturesResponse["data"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFeatures = useCallback(async () => {
    if (!businessId?.trim()) {
      setData(null);
      return;
    }

    const cached = getCached(businessId);
    if (cached) {
      setData(cached);
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
        setCached(businessId, res.data);
        setData(res.data);
      } else {
        setData(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [businessId, accessToken]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!businessId?.trim()) {
        if (!cancelled) setData(null);
        return;
      }
      const cached = getCached(businessId);
      if (cached) {
        if (!cancelled) setData(cached);
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
            setCached(businessId, res.data);
            setData(res.data);
          } else {
            setData(null);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setData(null);
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
