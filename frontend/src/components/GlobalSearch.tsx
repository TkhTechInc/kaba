"use client";

import { useCallback, useEffect, useId, useRef, useState, memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SearchIcon } from "@/assets/icons8";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { useGlobalSearch, type SearchResult, type SearchResultKind } from "@/hooks/use-global-search";

// ─── kind → icon ────────────────────────────────────────────────────────────

const KindIcon = memo(function KindIcon({ kind }: { kind: SearchResultKind }) {
  const cls = "h-4 w-4 shrink-0";
  if (kind === "invoice")
    return (
      <svg className={cls} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <rect x="3" y="2" width="14" height="16" rx="2" />
        <path d="M6 6h8M6 10h8M6 14h5" strokeLinecap="round" />
      </svg>
    );
  if (kind === "customer")
    return (
      <svg className={cls} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    );
  if (kind === "product")
    return (
      <svg className={cls} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.4 5M17 13l1.4 5M9 19a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  // debt
  return (
    <svg className={cls} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 6v4l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});

const KIND_COLORS: Record<SearchResultKind, string> = {
  invoice: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
  customer: "text-violet-500 bg-violet-50 dark:bg-violet-900/20",
  product: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
  debt: "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
};

// ─── flatten results for keyboard nav ───────────────────────────────────────

function flatResults(groups: ReturnType<typeof useGlobalSearch>["groups"]): SearchResult[] {
  return groups.flatMap((g) => g.results);
}

// ─── component ──────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const { t } = useLocale();
  const { token, businessId } = useAuth();
  const router = useRouter();
  const inputId = useId();

  const { query, handleQueryChange, groups, loading, open, close, prefetch, totalResults } =
    useGlobalSearch(token, businessId);

  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Reset active index whenever results change
  useEffect(() => {
    setActiveIdx(-1);
  }, [groups]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // Global keyboard shortcut: Ctrl+K / Cmd+K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const flat = flatResults(groups);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const result = flat[activeIdx];
        if (result) {
          router.push(result.href);
          close();
          inputRef.current?.blur();
        }
      } else if (e.key === "Escape") {
        close();
        inputRef.current?.blur();
      }
    },
    [open, flat, activeIdx, router, close]
  );

  const handleResultClick = useCallback(() => {
    close();
    inputRef.current?.blur();
  }, [close]);

  // Build a flat index map for aria-activedescendant
  let flatIdx = 0;
  const itemIdPrefix = `${inputId}-result`;

  return (
    <div className="relative hidden min-w-0 sm:block sm:max-w-[200px] md:max-w-[260px] lg:max-w-[320px]">
      {/* Input */}
      <label htmlFor={inputId} className="sr-only">
        {t("search.label")}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${inputId}-listbox`}
        aria-activedescendant={activeIdx >= 0 ? `${itemIdPrefix}-${activeIdx}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={prefetch}
        onKeyDown={handleKeyDown}
        placeholder={t("search.placeholder")}
        className="w-full min-w-0 rounded-full border bg-gray-2 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus-visible:border-primary dark:border-dark-3 dark:bg-dark-2 dark:hover:border-dark-4 dark:hover:bg-dark-3 dark:hover:text-dark-6 dark:focus-visible:border-primary sm:py-3 sm:pl-[42px] sm:pr-5 md:pl-[53px]"
      />
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dark-4 dark:text-dark-6 sm:left-4 sm:size-5 md:left-5" />

      {/* Kbd hint */}
      {!query && (
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-stroke px-1.5 py-0.5 text-[10px] font-medium text-dark-4 dark:border-dark-3 dark:text-dark-6 md:flex">
          <span>⌘</span>K
        </kbd>
      )}

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={close} aria-hidden="true" />
      )}

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-[min(420px,90vw)] rounded-xl border border-stroke bg-white shadow-xl dark:border-dark-3 dark:bg-gray-dark"
          role="dialog"
          aria-label={t("search.resultsLabel")}
        >
          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-dark-6">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              {t("search.searching")}
            </div>
          )}

          {/* Results */}
          {!loading && groups.length > 0 && (
            <ul
              ref={listRef}
              id={`${inputId}-listbox`}
              role="listbox"
              aria-label={t("search.resultsLabel")}
              className="max-h-[60vh] overflow-y-auto py-2"
            >
              {groups.map((group) => (
                <li key={group.kind} role="presentation">
                  {/* Group label */}
                  <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-dark-4 dark:text-dark-6">
                    {t(`search.group.${group.kind}` as Parameters<typeof t>[0])}
                  </p>
                  <ul role="group" aria-label={group.label}>
                    {group.results.map((result) => {
                      const idx = flatIdx++;
                      const isActive = idx === activeIdx;
                      return (
                        <li
                          key={result.id}
                          id={`${itemIdPrefix}-${idx}`}
                          data-idx={idx}
                          role="option"
                          aria-selected={isActive}
                        >
                          <Link
                            href={result.href}
                            onClick={handleResultClick}
                            className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                              isActive
                                ? "bg-gray-2 dark:bg-dark-2"
                                : "hover:bg-gray-2 dark:hover:bg-dark-2"
                            }`}
                          >
                            {/* Kind icon */}
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${KIND_COLORS[result.kind]}`}>
                              <KindIcon kind={result.kind} />
                            </span>
                            {/* Text */}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-dark dark:text-white">
                                {result.title}
                              </span>
                              {result.subtitle && (
                                <span className="block truncate text-xs text-dark-6 dark:text-dark-5">
                                  {result.subtitle}
                                </span>
                              )}
                            </span>
                            {/* Arrow */}
                            <svg className="h-3.5 w-3.5 shrink-0 text-dark-4 dark:text-dark-6" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          {/* No results */}
          {!loading && query.trim().length >= 2 && totalResults === 0 && (
            <div className="px-4 py-6 text-center text-sm text-dark-6">
              {t("search.noResults", { query: query.trim() })}
            </div>
          )}

          {/* Footer hint */}
          {!loading && groups.length > 0 && (
            <div className="flex items-center gap-3 border-t border-stroke px-4 py-2 dark:border-dark-3">
              <span className="flex items-center gap-1 text-[10px] text-dark-4 dark:text-dark-6">
                <kbd className="rounded border border-stroke px-1 py-0.5 font-mono text-[10px] dark:border-dark-3">↑↓</kbd>
                {t("search.hint.navigate")}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-dark-4 dark:text-dark-6">
                <kbd className="rounded border border-stroke px-1 py-0.5 font-mono text-[10px] dark:border-dark-3">↵</kbd>
                {t("search.hint.open")}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-dark-4 dark:text-dark-6">
                <kbd className="rounded border border-stroke px-1 py-0.5 font-mono text-[10px] dark:border-dark-3">Esc</kbd>
                {t("search.hint.close")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
