"use client";

import { useLocale, LOCALE_LABELS, type Locale } from "@/contexts/locale-context";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export function LanguagePicker() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${LOCALE_LABELS[locale]}`}
        className="flex items-center gap-1.5 rounded-lg border border-stroke bg-transparent px-2.5 py-1.5 text-xs font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
      >
        <span aria-hidden="true" className="text-sm">🌍</span>
        <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
        <span className="sm:hidden">{locale.toUpperCase()}</span>
        <svg
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-xl border border-stroke bg-white py-1 shadow-lg dark:border-dark-3 dark:bg-gray-dark"
        >
          {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([code, label]) => (
            <li key={code} role="option" aria-selected={locale === code}>
              <button
                type="button"
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-4 py-2 text-sm transition",
                  locale === code
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-dark hover:bg-gray-2 dark:text-white dark:hover:bg-dark-2"
                )}
              >
                {locale === code && (
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 7l3.5 3.5L12 3" />
                  </svg>
                )}
                {locale !== code && <span className="w-3.5" aria-hidden="true" />}
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
