"use client";

import Link from "next/link";
import { Price } from "@/components/ui/Price";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useDashboardHome } from "@/app/(home)/_components/dashboard-home-provider";
import { useLocale } from "@/contexts/locale-context";
import type { Debt } from "@/services/debts.service";

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

export function DashboardDebtsToCollect({ className }: { className?: string }) {
  const { businessId } = useAuth();
  const { data: homeData, loading } = useDashboardHome();
  const { t } = useLocale();
  const debts = (homeData?.debts?.items ?? []) as Debt[];

  if (!businessId) return null;

  return (
    <div
      className={cn(
        "col-span-12 rounded-[10px] bg-white py-6 shadow-1 dark:bg-gray-dark dark:shadow-card xl:col-span-4",
        className
      )}
    >
      <div className="mb-5.5 flex items-center justify-between px-7.5">
        <h2 className="text-body-2xlg font-bold text-dark dark:text-white">
          {t("dashboard.debtsToCollect.title")}
        </h2>
        <Link
          href="/debts"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("dashboard.debtsToCollect.viewAll")}
        </Link>
      </div>

      {loading ? (
        <div className="mx-7.5 min-h-[120px] animate-pulse rounded-lg bg-gray-1 dark:bg-dark-2/50" />
      ) : debts.length === 0 ? (
        <p className="px-7.5 py-8 text-center text-dark-6">
          {t("dashboard.debtsToCollect.noPending")}{" "}
          <Link href="/debts" className="text-primary hover:underline">
            {t("dashboard.debtsToCollect.addDebt")}
          </Link>
        </p>
      ) : (
        <ul>
          {debts.map((debt) => (
            <li key={debt.id}>
              <Link
                href="/debts"
                className="flex items-center gap-4.5 px-7.5 py-3 outline-none hover:bg-gray-2 focus-visible:bg-gray-2 dark:hover:bg-dark-2 dark:focus-visible:bg-dark-2"
              >
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {debt.debtorName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium text-dark dark:text-white">
                    {debt.debtorName}
                  </h3>
                  <p className="text-sm text-dark-6">
                    <Price amount={debt.amount} currency={debt.currency} /> · {t("dashboard.debtsToCollect.due", { date: formatDate(debt.dueDate) })}
                  </p>
                </div>
                {debt.status === "overdue" && (
                  <span className="shrink-0 rounded-full bg-red/10 px-2 py-0.5 text-xs font-medium text-red">
                    {t("dashboard.debtsToCollect.overdue")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
