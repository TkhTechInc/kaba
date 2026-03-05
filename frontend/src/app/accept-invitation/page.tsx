"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

function AcceptInvitationRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    const params = token ? `?token=${encodeURIComponent(token)}` : "";
    router.replace(`/invite${params}`);
  }, [router, token]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-2 dark:bg-[#020d1a]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-dark-4 dark:text-dark-6">Redirecting...</p>
    </div>
  );
}

/**
 * Redirects /accept-invitation?token=xxx to /invite?token=xxx for backwards compatibility.
 */
export default function AcceptInvitationRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-2 dark:bg-[#020d1a]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-dark-4 dark:text-dark-6">Redirecting...</p>
        </div>
      }
    >
      <AcceptInvitationRedirectContent />
    </Suspense>
  );
}
