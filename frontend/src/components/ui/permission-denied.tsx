"use client";

import Link from "next/link";

interface PermissionDeniedProps {
  /** What the user tried to access, e.g. "API Keys" */
  resource?: string;
  /** Optional extra message (e.g. plan upgrade hint) */
  hint?: string;
  /** Show a link back to settings */
  backHref?: string;
  backLabel?: string;
}

/**
 * Shown when a backend 403 means the current role/plan cannot access a resource.
 * Replaces the raw "Forbidden" error string in the UI.
 */
export function PermissionDenied({
  resource,
  hint,
  backHref = "/settings",
  backLabel = "Back to Settings",
}: PermissionDeniedProps) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center dark:border-dark-3 dark:bg-gray-dark">
      {/* Lock icon */}
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <svg
          className="h-7 w-7 text-amber-600 dark:text-amber-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </span>

      <h2 className="mb-1.5 text-base font-semibold text-dark dark:text-white">
        {resource ? `You don't have access to ${resource}` : "Access denied"}
      </h2>

      <p className="mb-5 max-w-sm text-sm text-dark-4 dark:text-dark-6">
        {hint ??
          "Your current role or plan doesn't include this feature. Contact your workspace owner or upgrade your plan."}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={backHref}
          className="rounded-lg border border-stroke px-5 py-2 text-sm font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
        >
          {backLabel}
        </Link>
        <Link
          href="/settings/plans"
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-opacity-90"
        >
          View plans
        </Link>
      </div>
    </div>
  );
}
