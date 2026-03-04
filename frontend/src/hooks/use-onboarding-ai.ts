"use client";

import { apiPost } from "@/lib/api-client";
import { useAuthOptional } from "@/contexts/auth-context";
import { useCallback, useMemo, useState } from "react";

export type OnboardingAISuggestion = {
  businessName?: string;
  businessType?: string;
  country?: string;
  currency?: string;
  taxRegime?: string;
  message?: string;
};

type AIChatResponse = {
  success: boolean;
  data: OnboardingAISuggestion;
};

export function useOnboardingAI(businessId: string | null) {
  const auth = useAuthOptional();
  const token = auth?.token ?? null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const opts = useMemo(
    () => ({ token: token ?? undefined }),
    [token]
  );

  const sendMessage = useCallback(
    async (message: string): Promise<OnboardingAISuggestion> => {
      if (!businessId?.trim()) throw new Error("businessId required");
      if (!message?.trim()) throw new Error("message required");
      setLoading(true);
      setError(null);
      try {
        const res = await apiPost<AIChatResponse>(
          `/api/v1/onboarding/ai-chat?businessId=${encodeURIComponent(businessId)}`,
          { message: message.trim() },
          opts
        );
        if (res.success && res.data) {
          return res.data;
        }
        throw new Error("AI chat failed");
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [businessId, opts]
  );

  return useMemo(
    () => ({
      sendMessage,
      loading,
      error,
    }),
    [sendMessage, loading, error]
  );
}
