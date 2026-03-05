"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrencySymbol, standardFormat } from "@/lib/format-number";
import { cn } from "@/lib/utils";
import { createDebtsApi } from "@/services/debts.service";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
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
  const { businessId, token } = useAuth();
  const features = useFeatures(businessId);
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<Debt[]>([]);

  useEffect(() => {
    if (!businessId || !token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    createDebtsApi(token)
      .list(businessId, 1, 10)
      .then((res) => {
        const items = res.data?.items ?? [];
        if (!cancelled) setDebts(items.filter((d) => d.status !== "paid").slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setDebts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, token]);

  if (!businessId) return null;

  const currency = features.currency ?? "NGN";
  const symbol = getCurrencySymbol(currency);

  return (
    <div
      className={cn(
        "col-span-12 rounded-[10px] bg-white py-6 shadow-1 dark:bg-gray-dark dark:shadow-card xl:col-span-4",
        className
      )}
    >
      <div className="mb-5.5 flex items-center justify-between px-7.5">
        <h2 className="text-body-2xlg font-bold text-dark dark:text-white">
          People who owe me
        </h2>
        <Link
          href="/debts"
          className="text-sm font-medium text-primary hover:underline"
        >
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="mx-7.5 min-h-[120px] animate-pulse rounded-lg bg-gray-1 dark:bg-dark-2/50" />
      ) : debts.length === 0 ? (
        <p className="px-7.5 py-8 text-center text-dark-6">
          No pending debts.{" "}
          <Link href="/debts" className="text-primary hover:underline">
            Add a debt
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
                    {symbol}
                    {standardFormat(debt.amount)} · Due {formatDate(debt.dueDate)}
                  </p>
                </div>
                {debt.status === "overdue" && (
                  <span className="shrink-0 rounded-full bg-red/10 px-2 py-0.5 text-xs font-medium text-red">
                    Overdue
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
