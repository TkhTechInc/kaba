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
  const authLoading = auth?.isLoading ?? true;
  const hasBusinesses = (auth?.businesses?.length ?? 0) > 0;
  const { data, loading } = useOnboarding(businessId);

  const isOnboardingPage = pathname === "/onboarding";

  useEffect(() => {
    if (isOnboardingPage) return;
    if (authLoading) return;           // wait for auth to hydrate first
    if (!hasBusinesses || !businessId) return;
    if (loading) return;               // wait for onboarding fetch
    if (data?.isComplete) return;      // already done — show dashboard
    router.replace("/onboarding");
  // router excluded — not stable in Next.js App Router
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnboardingPage, authLoading, hasBusinesses, businessId, loading, data?.isComplete]);

  if (isOnboardingPage) {
    return <>{children}</>;
  }

  // Block rendering until auth has hydrated AND onboarding status is known.
  // This prevents a flash of dashboard content before a redirect to /onboarding.
  const notReady =
    authLoading ||
    (hasBusinesses && businessId && loading && data === null);

  if (notReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-2 dark:bg-[#020d1a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
