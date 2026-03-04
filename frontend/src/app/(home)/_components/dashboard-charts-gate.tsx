"use client";

import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import type { ReactNode } from "react";

type PropsType = {
  children: ReactNode;
};

/**
 * Client gate: only renders children when a business is selected and the
 * reports feature is enabled. The children (async server components) must be
 * rendered by the parent server page – not here – to avoid the
 * "async Client Component" error.
 */
export function DashboardChartsGate({ children }: PropsType) {
  const { businessId } = useAuth();
  const features = useFeatures(businessId);

  if (!businessId || !features.isEnabled("reports")) {
    return null;
  }

  return <>{children}</>;
}
