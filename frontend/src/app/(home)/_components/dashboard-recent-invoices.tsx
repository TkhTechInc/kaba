"use client";

import Link from "next/link";
import { ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { Price } from "@/components/ui/Price";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useDashboardHome } from "@/app/(home)/_components/dashboard-home-provider";
import { useLocale } from "@/contexts/locale-context";
import type { Invoice } from "@/services/invoices.service";

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const variant =
    status === "paid"
      ? "bg-green/10 text-green"
      : status === "overdue"
        ? "bg-red/10 text-red"
        : "bg-amber/10 text-amber-600 dark:text-amber-400";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        variant
      )}
    >
      {label}
    </span>
  );
}

export function DashboardRecentInvoices({ className }: { className?: string }) {
  const { businessId } = useAuth();
  const { data: homeData, loading } = useDashboardHome();
  const { t } = useLocale();
  const invoices = (homeData?.pendingInvoices?.items ?? []) as Invoice[];

  if (!businessId) return null;

  const emptyMsg = (
    <>
      {t("dashboard.recentInvoices.noInvoices")}{" "}
      <Link href="/invoices/new" className="text-primary hover:underline">
        {t("dashboard.recentInvoices.createFirst")}
      </Link>
    </>
  );

  return (
    <div
      className={cn(
        "col-span-12 grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card xl:col-span-8",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-body-2xlg font-bold text-dark dark:text-white">
          {t("dashboard.recentInvoices.title")}
        </h2>
        <Link
          href="/invoices"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("dashboard.recentInvoices.viewAll")}
        </Link>
      </div>

      {loading ? (
        <div className="min-h-[120px] animate-pulse rounded-lg bg-gray-1 dark:bg-dark-2/50" />
      ) : invoices.length === 0 ? (
        <p className="py-8 text-center text-dark-6">{emptyMsg}</p>
      ) : (
        <ResponsiveDataList<Invoice>
          items={invoices}
          keyExtractor={(inv) => inv.id}
          emptyMessage={emptyMsg}
          columns={[
            {
              key: "amount",
              label: t("dashboard.recentInvoices.amount"),
              render: (inv) => <Price amount={inv.amount} currency={inv.currency} />,
              prominent: true,
              cellClassName: "font-semibold",
            },
            { key: "dueDate", label: t("dashboard.recentInvoices.dueDate"), render: (inv) => formatDate(inv.dueDate) },
            { key: "status", label: t("dashboard.recentInvoices.status"), render: (inv) => <StatusBadge status={inv.status} label={inv.status === "pending_approval" ? t("invoices.status.pendingApproval") : t(`invoices.filter.${inv.status}`) || inv.status} /> },
          ]}
          renderActions={(inv) =>
            inv.id ? (
              <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                {t("dashboard.recentInvoices.view")}
              </Link>
            ) : null
          }
        />
      )}
    </div>
  );
}
