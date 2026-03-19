"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";

export function AuthCallbackContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { completeOAuth, checkAuthFromCookie } = useAuth();
  const router = useRouter();
  const params = use(searchParams);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof params?.token === "string" ? params.token : null;
    if (token) {
      completeOAuth(token)
        .then(() => {
          // Redirect to dashboard — OnboardingGuard will redirect to /onboarding if needed.
          // Returning users with completed onboarding go straight to dashboard (no onboarding flash).
          setTimeout(() => router.replace("/"), 100);
        })
        .catch(() => setError("Invalid token. Please try signing in again."));
    } else {
      checkAuthFromCookie()
        .then((ok) => {
          if (ok) {
            setTimeout(() => router.replace("/"), 100);
          } else {
            setError("No token received. Please try signing in again.");
          }
        })
        .catch(() => setError("Sign-in failed. Please try again."));
    }
  }, [params, completeOAuth, checkAuthFromCookie, router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-red">{error}</p>
        <a href="/auth/sign-in" className="text-primary underline">
          Back to Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p>Signing you in...</p>
    </div>
  );
}
