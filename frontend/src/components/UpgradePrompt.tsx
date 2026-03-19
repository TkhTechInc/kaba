"use client";

import Link from "next/link";
import { useLocale } from "@/contexts/locale-context";

interface UpgradePromptProps {
  feature: string;
  className?: string;
}

export function UpgradePrompt({ feature, className = "" }: UpgradePromptProps) {
  const { t } = useLocale();
  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30 ${className}`}
    >
      <p className="mb-2 font-medium text-amber-800 dark:text-amber-200">
        {t("upgradePrompt.featureNotAvailable", { feature })}
      </p>
      <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
        {t("upgradePrompt.upgradeBody")}
      </p>
      <Link
        href="/settings"
        className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
      >
        {t("upgradePrompt.upgradeButton")}
      </Link>
    </div>
  );
}
