"use client";

import { useOnboarding } from "@/hooks/use-onboarding";
import { useAuthOptional } from "@/contexts/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

/**
 * Redirects to /onboarding if user has businesses but onboarding is not complete.
 * Use inside AuthGuard, wrapping dashboard content.
 */
export function OnboardingGuard({ children }: { children: ReactNode }) {
  const auth = useAuthOptional();
  const pathname = usePathname();
  const router = useRouter();
  const businessId = auth?.businessId ?? null;
  const { data, loading } = useOnboarding(businessId);

  const hasBusinesses = (auth?.businesses?.length ?? 0) > 0;
  const isOnboardingPage = pathname === "/onboarding";

  useEffect(() => {
    if (isOnboardingPage) return;
    if (!hasBusinesses || !businessId) return;
    if (loading) return;
    if (data?.isComplete) return;
    router.replace("/onboarding");
  // router is intentionally excluded — it is not stable in Next.js App Router
  // and would cause this effect to re-run on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBusinesses, businessId, loading, data?.isComplete, isOnboardingPage]);

  if (isOnboardingPage) {
    return <>{children}</>;
  }

  // If user has businesses but we don't have their onboarding status yet, show
  // a spinner to avoid a flash of dashboard content before a potential redirect.
  // Key: once data resolves (loading=false), we ALWAYS render — the useEffect
  // above handles the redirect. Never block render based on isComplete value,
  // only block while the initial fetch is in flight.
  const isStillLoading = hasBusinesses && businessId && loading && data === null;
  if (isStillLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-2 dark:bg-[#020d1a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
