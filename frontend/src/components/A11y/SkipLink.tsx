"use client";

import { useLocale } from "@/contexts/locale-context";

/**
 * Skip link for keyboard/screen reader users.
 * Renders a link that becomes visible on focus, allowing users to skip navigation and jump to main content.
 */
export function SkipLink({ targetId = "main-content", children }: { targetId?: string; children?: React.ReactNode }) {
  const { t } = useLocale();
  const label = children ?? t("common.skipToContent");
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      {label}
    </a>
  );
}
