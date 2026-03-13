"use client";

import Link from "next/link";
import { useLocale } from "@/contexts/locale-context";

export type ErrorCode = 400 | 401 | 403 | 404 | 408 | 429 | 500 | 502 | 503 | (number & {});

interface ErrorStyle {
  icon: React.ReactNode;
  accentClass: string;
  iconBgClass: string;
  /** translation namespace key, e.g. "404" | "403" | "500" | "default" */
  tKey: string;
}

function getErrorStyle(code: number): ErrorStyle {
  if (code === 404) {
    return {
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      accentClass: "text-primary dark:text-primary",
      iconBgClass: "bg-primary/10 text-primary dark:bg-primary/20",
      tKey: "404",
    };
  }

  if (code === 403) {
    return {
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      accentClass: "text-amber-600 dark:text-amber-400",
      iconBgClass: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
      tKey: "403",
    };
  }

  if (code === 401) {
    return {
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      accentClass: "text-blue-600 dark:text-blue-400",
      iconBgClass: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
      tKey: "401",
    };
  }

  if (code === 429) {
    return {
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      accentClass: "text-amber-600 dark:text-amber-400",
      iconBgClass: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
      tKey: "429",
    };
  }

  if (code >= 500) {
    return {
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      accentClass: "text-red dark:text-red-400",
      iconBgClass: "bg-red/10 text-red dark:bg-red/20 dark:text-red-400",
      tKey: "500",
    };
  }

  return {
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accentClass: "text-dark-4 dark:text-dark-6",
    iconBgClass: "bg-gray-2 text-dark-4 dark:bg-dark-3 dark:text-dark-6",
    tKey: "default",
  };
}

export interface ErrorViewProps {
  /** HTTP-like error code — drives icon, title, description, and color defaults */
  code?: ErrorCode;
  /** Override the translated title */
  title?: string;
  /** Override the translated description */
  description?: string;
  /** Primary CTA label — defaults to translated "Go to dashboard" */
  primaryLabel?: string;
  /** Primary CTA href — defaults to "/" */
  primaryHref?: string;
  /** Secondary CTA label — shown only when provided */
  secondaryLabel?: string;
  /** Secondary CTA href */
  secondaryHref?: string;
  /** Callback for a "Try again" secondary action (use instead of secondaryHref for error boundaries) */
  onRetry?: () => void;
  /** Render in full-page mode (centered in viewport) vs. inline card mode */
  fullPage?: boolean;
}

/**
 * Error-code–agnostic, localized error display.
 * Works as a full-page error (not-found, error.tsx) or as an inline card inside a page section.
 * All copy is driven by the active locale via useLocale(); prop overrides take precedence.
 */
export function ErrorView({
  code = 500,
  title,
  description,
  primaryLabel,
  primaryHref = "/",
  secondaryLabel,
  secondaryHref,
  onRetry,
  fullPage = false,
}: ErrorViewProps) {
  const { t } = useLocale();
  const style = getErrorStyle(code);

  const resolvedTitle = title ?? t(`errors.${style.tKey}.title`);
  const resolvedDescription = description ?? t(`errors.${style.tKey}.description`);
  const resolvedPrimaryLabel = primaryLabel ?? t("errors.goToDashboard");
  const retryLabel = t("errors.tryAgain");
  const resolvedSecondaryLabel = secondaryLabel ?? t("errors.goBack");

  const content = (
    <div className="flex flex-col items-center justify-center p-10 text-center">
      {/* Error code badge */}
      <span className={`mb-3 text-xs font-semibold uppercase tracking-widest ${style.accentClass}`}>
        {t("errors.badge", { code })}
      </span>

      {/* Icon */}
      <span className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${style.iconBgClass}`}>
        {style.icon}
      </span>

      {/* Title */}
      <h1 className="mb-2 text-xl font-bold text-dark dark:text-white">
        {resolvedTitle}
      </h1>

      {/* Description */}
      <p className="mb-7 max-w-sm text-sm leading-relaxed text-dark-4 dark:text-dark-6">
        {resolvedDescription}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-stroke px-5 py-2 text-sm font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            {retryLabel}
          </button>
        )}

        {secondaryHref && !onRetry && (
          <Link
            href={secondaryHref}
            className="rounded-lg border border-stroke px-5 py-2 text-sm font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            {resolvedSecondaryLabel}
          </Link>
        )}

        <Link
          href={primaryHref}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-opacity-90"
        >
          {resolvedPrimaryLabel}
        </Link>
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-2 dark:bg-[#020D1A]">
        <div className="w-full max-w-md">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 dark:border-dark-3 dark:bg-gray-dark">
      {content}
    </div>
  );
}
