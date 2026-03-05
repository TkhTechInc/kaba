"use client";

import { useEffect, useState } from "react";
import { PeriodPicker } from "@/components/period-picker";
import { PaymentsOverviewChart } from "@/components/Charts/payments-overview/chart";
import { ChartEmptyState } from "@/components/Charts/chart-empty-state";
import { getCurrencySymbol, standardFormat } from "@/lib/format-number";
import { cn } from "@/lib/utils";
import { getPaymentsOverview } from "@/services/dashboard.service";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { useSearchParams } from "next/navigation";

type PropsType = {
  className?: string;
};

function parseTimeFrame(selected: string | null, sectionKey: string): "monthly" | "yearly" {
  const part = selected?.split(",").find((v) => v.includes(sectionKey));
  const value = part?.split(":")[1];
  return value === "yearly" ? "yearly" : "monthly";
}

export function DashboardPaymentsOverview({ className }: PropsType) {
  const { businessId, token } = useAuth();
  const features = useFeatures(businessId);
  const searchParams = useSearchParams();
  const selected = searchParams.get("selected_time_frame");
  const timeFrame = parseTimeFrame(selected, "payments_overview");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof getPaymentsOverview>>>(null);

  useEffect(() => {
    if (!businessId || !token) {
      setLoading(false);
      setData(null);
      return;
    }
    let cancelled = false;
    getPaymentsOverview(businessId, token, timeFrame)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, token, timeFrame]);

  if (!businessId) return null;

  const currency = data?.currency ?? features.currency ?? "NGN";
  const symbol = getCurrencySymbol(currency);
  const hasData = data && (data.received.some((d) => d.y > 0) || data.due.some((d) => d.y > 0));
  const receivedTotal = data?.received.reduce((acc, { y }) => acc + y, 0) ?? 0;
  const dueTotal = data?.due.reduce((acc, { y }) => acc + y, 0) ?? 0;

  return (
    <div
      className={cn(
        "col-span-12 xl:col-span-7 grid gap-2 rounded-[10px] bg-white px-7.5 pb-6 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-body-2xlg font-bold text-dark dark:text-white">
          Payments Overview
        </h2>
        <PeriodPicker defaultValue={timeFrame} sectionKey="payments_overview" />
      </div>

      {loading ? (
        <div className="min-h-[310px] animate-pulse rounded-lg bg-gray-1 dark:bg-dark-2/50" />
      ) : !data ? (
        <ChartEmptyState message="Unable to load payments overview." />
      ) : !hasData ? (
        <ChartEmptyState message="No data yet. Add ledger entries or invoices." />
      ) : (
        <PaymentsOverviewChart data={data} />
      )}

      <dl className="grid divide-stroke text-center dark:divide-dark-3 sm:grid-cols-2 sm:divide-x [&>div]:flex [&>div]:flex-col-reverse [&>div]:gap-1">
        <div className="dark:border-dark-3 max-sm:mb-3 max-sm:border-b max-sm:pb-3">
          <dt className="text-xl font-bold text-dark dark:text-white">
            {symbol}{standardFormat(receivedTotal)}
          </dt>
          <dd className="font-medium dark:text-dark-6">Received Amount</dd>
        </div>
        <div>
          <dt className="text-xl font-bold text-dark dark:text-white">
            {symbol}{standardFormat(dueTotal)}
          </dt>
          <dd className="font-medium dark:text-dark-6">Due Amount</dd>
        </div>
      </dl>
    </div>
  );
}
