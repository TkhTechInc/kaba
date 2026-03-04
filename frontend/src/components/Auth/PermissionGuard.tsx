"use client";

import { useAuthOptional } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { Permission } from "@/types/permissions";

interface PermissionGuardProps {
  children: ReactNode;
  /** Required permission (e.g. ledger:read). User must have this for the current business. */
  permission: Permission;
  /** Optional: redirect path when forbidden. Default: / */
  redirectTo?: string;
  /** Optional: show 403 message instead of redirect */
  show403?: boolean;
}

export function PermissionGuard({
  children,
  permission,
  redirectTo = "/",
  show403 = false,
}: PermissionGuardProps) {
  const auth = useAuthOptional();
  const permissions = usePermissions(auth?.businessId ?? null);
  const pathname = usePathname();
  const router = useRouter();

  const hasAccess = permissions.hasPermission(permission);

  useEffect(() => {
    if (auth?.isLoading || !auth?.businessId) return;
    if (!hasAccess) {
      if (show403) return;
      router.replace(redirectTo);
    }
  }, [hasAccess, auth?.isLoading, auth?.businessId, redirectTo, router, show403]);

  if (auth?.isLoading || !auth?.businessId) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!hasAccess) {
    if (show403) {
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-900 dark:bg-red-950/30">
          <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">
            Access Denied
          </h2>
          <p className="text-center text-red-600 dark:text-red-500">
            You do not have permission to access this page. Contact your admin to
            request access.
          </p>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90"
          >
            Go to Dashboard
          </button>
        </div>
      );
    }
    return null;
  }

  return <>{children}</>;
}
