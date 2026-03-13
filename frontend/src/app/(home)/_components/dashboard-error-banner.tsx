"use client";

import { useDashboardHome } from "./dashboard-home-provider";
import { useDashboardRefresh } from "./dashboard-refresh-provider";
import { useLocale } from "@/contexts/locale-context";

export function DashboardErrorBanner() {
  const { error } = useDashboardHome();
  const { refresh } = useDashboardRefresh();
  const { t } = useLocale();

  if (!error) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red/30 bg-red/5 px-5 py-3 text-sm text-red dark:border-red/20 dark:bg-red/10"
    >
      <span>{t("dashboard.errorBanner.message")}</span>
      <button
        type="button"
        onClick={() => refresh()}
        className="font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {t("dashboard.errorBanner.retry")}
      </button>
    </div>
  );
}
