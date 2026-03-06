"use client";

import { useId } from "react";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export interface PaginationWithPageSizeProps {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  /** Show pagination controls when total exceeds this (default: 0) */
  showWhenTotalExceeds?: number;
}

export function PaginationWithPageSize({
  page,
  total,
  limit,
  onPageChange,
  onLimitChange,
  showWhenTotalExceeds = 0,
}: PaginationWithPageSizeProps) {
  const selectId = useId();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const showPagination = total > showWhenTotalExceeds;

  if (!showPagination) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stroke p-4 dark:border-dark-3">
      <div className="flex items-center gap-2">
        <label htmlFor={selectId} className="text-sm text-dark-6">
          Per page:
        </label>
        <select
          id={selectId}
          value={limit}
          onChange={(e) => {
            onLimitChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="rounded border border-stroke bg-white px-2 py-1 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded border border-stroke px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:bg-gray-2 dark:border-dark-3 dark:hover:enabled:bg-dark-2"
        >
          Previous
        </button>
        <span className="py-1 text-sm">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded border border-stroke px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:bg-primary hover:enabled:border-primary hover:enabled:text-white dark:border-dark-3"
        >
          Next
        </button>
      </div>
    </div>
  );
}
