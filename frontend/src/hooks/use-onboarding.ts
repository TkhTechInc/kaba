"use client";

import {
  apiGet,
  apiPatch,
  apiPost,
} from "@/lib/api-client";
import { useAuthOptional } from "@/contexts/auth-context";
import { useCallback, useEffect, useMemo, useState } from "react";

export type OnboardingStep =
  | "businessName"
  | "businessType"
  | "country"
  | "currency"
  | "taxRegime"
  | "details";

export type OnboardingAnswers = {
  businessName?: string;
  businessType?: string;
  country?: string;
  currency?: string;
  taxRegime?: string;
  /** IFU (Benin) or NCC (Côte d'Ivoire) — required for fiscal e-invoicing certification */
  taxId?: string;
  /** Legal structure: auto_entrepreneur | sarl | sa | snc | association | other */
  legalStatus?: string;
  /** RCCM registration number */
  rccm?: string;
  businessAddress?: string;
  businessPhone?: string;
  fiscalYearStart?: number;
  slug?: string;
  description?: string;
};

export type OnboardingProgress = {
  step: OnboardingStep;
  completedSteps: OnboardingStep[];
  answers: OnboardingAnswers;
  isComplete: boolean;
  startedAt: string;
  completedAt?: string;
};

type OnboardingResponse = {
  success: boolean;
  data: OnboardingProgress;
};

export function useOnboarding(businessId: string | null) {
  const auth = useAuthOptional();
  const token = auth?.token ?? null;
  const [data, setData] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(() => !!businessId?.trim());
  const [error, setError] = useState<Error | null>(null);

  // Use primitives directly in deps — avoids creating a new opts object every render
  // which was causing fetchProgress to get a new reference → infinite useEffect loop.
  const fetchProgress = useCallback(async () => {
    if (!businessId?.trim()) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<OnboardingResponse>(
        `/api/v1/onboarding?businessId=${encodeURIComponent(businessId)}`,
        { token: token ?? undefined }
      );
      if (res.success && res.data) {
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
  }, [businessId, token]); // primitives only — stable references

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const update = useCallback(
    async (
      answers: Partial<OnboardingAnswers> & { onboardingComplete?: boolean }
    ) => {
      if (!businessId?.trim()) throw new Error("businessId required");
      setLoading(true);
      setError(null);
      try {
        const res = await apiPatch<OnboardingResponse>(
          `/api/v1/onboarding?businessId=${encodeURIComponent(businessId)}`,
          answers,
          { token: token ?? undefined }
        );
        if (res.success && res.data) {
          setData(res.data);
          return res.data;
        }
        throw new Error("Update failed");
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [businessId, token]
  );

  const complete = useCallback(async () => {
    if (!businessId?.trim()) throw new Error("businessId required");
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<OnboardingResponse>(
        `/api/v1/onboarding/complete?businessId=${encodeURIComponent(businessId)}`,
        {},
        { token: token ?? undefined }
      );
      if (res.success && res.data) {
        setData(res.data);
        return res.data;
      }
      throw new Error("Complete failed");
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  return useMemo(
    () => ({
      data,
      loading,
      error,
      refetch: fetchProgress,
      update,
      complete,
      isComplete: data?.isComplete ?? false,
    }),
    [data, loading, error, fetchProgress, update, complete]
  );
}
