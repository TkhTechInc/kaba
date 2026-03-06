"use client";

import Link from "next/link";
import { useLocale } from "@/contexts/locale-context";

export function DashboardQuickActions() {
  const { t } = useLocale();
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <Link
        href="/invoices/new"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {t("dashboard.action.newInvoice")}
      </Link>
      <Link
        href="/ledger"
        className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {t("dashboard.action.recordTransaction")}
      </Link>
      <Link
        href="/receipts"
        className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {t("dashboard.action.uploadReceipt")}
      </Link>
      <Link
        href="/reports"
        className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {t("dashboard.action.viewReports")}
      </Link>
    </div>
  );
}
