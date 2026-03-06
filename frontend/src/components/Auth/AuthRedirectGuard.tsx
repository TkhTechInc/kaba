"use client";

import { useAuthOptional } from "@/contexts/auth-context";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";

function isValidReturnUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("/") && !url.startsWith("//");
}

function AuthRedirectGuardContent({ children }: { children: ReactNode }) {
  const auth = useAuthOptional();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isAuthenticated = !!auth?.token;
  const isLoading = auth?.isLoading ?? true;
  const isAuthPage = pathname?.startsWith("/auth/");
  const isResetPassword = pathname === "/auth/reset-password";
  const returnUrl = searchParams.get("returnUrl");

  useEffect(() => {
    if (isLoading || !isAuthPage) return;
    if (isResetPassword) return; // Allow reset-password even when logged in (OAuth user adding password)
    if (isAuthenticated) {
      const target = isValidReturnUrl(returnUrl ?? "") ? (returnUrl ?? "/") : "/";
      router.replace(target);
    }
  }, [isAuthenticated, isLoading, isAuthPage, isResetPassword, returnUrl, router]);

  if (isAuthPage && !isResetPassword && isAuthenticated && !isLoading) {
    return null; // Redirecting
  }

  return <>{children}</>;
}

/**
 * Redirects logged-in users away from auth pages (sign-in, sign-up, etc.) to dashboard.
 * Prevents back-button confusion: if you're logged in, you shouldn't see the sign-in page.
 * Uses returnUrl from query when present (e.g. after invite redirect).
 */
export function AuthRedirectGuard({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <AuthRedirectGuardContent>{children}</AuthRedirectGuardContent>
    </Suspense>
  );
}
