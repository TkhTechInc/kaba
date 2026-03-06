"use client";

import { useAuthOptional } from "@/contexts/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const PUBLIC_PATHS = ["/auth/sign-in", "/auth/sign-up", "/auth/forgot-password", "/auth/reset-password"];

export function AuthGuard({ children }: { children: ReactNode }) {
  const auth = useAuthOptional();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthenticated = !!auth?.token;
  const isLoading = auth?.isLoading ?? true;
  const isPublic = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (isLoading) return;
    if (!isPublic && !isAuthenticated) {
      router.replace("/auth/sign-in");
    }
  }, [isAuthenticated, isLoading, isPublic, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-2 dark:bg-[#020d1a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isPublic && !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
