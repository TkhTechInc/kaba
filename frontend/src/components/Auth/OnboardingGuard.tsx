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
  }, [hasBusinesses, businessId, loading, data?.isComplete, isOnboardingPage, router]);

  if (isOnboardingPage) {
    return <>{children}</>;
  }

  // Show spinner until we know onboarding status - avoids dashboard flash before redirect
  // Also show when hasBusinesses but businessId not yet set (auth still hydrating)
  const needsOnboarding =
    (hasBusinesses && !businessId) ||
    (hasBusinesses && businessId && (!data?.isComplete || loading));
  if (needsOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-2 dark:bg-[#020d1a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
