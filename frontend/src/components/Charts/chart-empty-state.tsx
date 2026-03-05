"use client";

import { cn } from "@/lib/utils";

type PropsType = {
  message?: string;
  className?: string;
};

/** Placeholder for chart area when there's no data or an error. Keeps the chart card structure visible. */
export function ChartEmptyState({
  message = "No data yet",
  className,
}: PropsType) {
  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-stroke bg-gray-1/50 dark:border-dark-3 dark:bg-dark-2/30",
        className
      )}
      role="img"
      aria-label={message}
    >
      <svg
        className="mb-3 size-12 text-dark-5 dark:text-dark-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
      <p className="text-sm font-medium text-dark-5 dark:text-dark-6">{message}</p>
    </div>
  );
}
