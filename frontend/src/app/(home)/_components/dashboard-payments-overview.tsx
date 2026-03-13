"use client";

import { useEffect, useState } from "react";
import { PeriodPicker } from "@/components/period-picker";
import { PaymentsOverviewChart } from "@/components/Charts/payments-overview/chart";
import { ChartEmptyState } from "@/components/Charts/chart-empty-state";
import { Price } from "@/components/ui/Price";
import { cn } from "@/lib/utils";
import { getPaymentsOverview } from "@/services/dashboard.service";
import { useAuth } from "@/contexts/auth-context";
import { useDashboardHome } from "@/app/(home)/_components/dashboard-home-provider";
import { useFeatures } from "@/hooks/use-features";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/contexts/locale-context";

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
  const { data: homeData, loading: homeLoading } = useDashboardHome();
  const features = useFeatures(businessId);
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const selected = searchParams.get("selected_time_frame");
  const timeFrame = parseTimeFrame(selected, "payments_overview");

  const [overrideData, setOverrideData] = useState<Awaited<ReturnType<typeof getPaymentsOverview>> | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(false);

  const useDefault = timeFrame === "monthly";
  const data = useDefault ? (homeData?.paymentsOverview ?? null) : overrideData;
  const loading = useDefault ? homeLoading : overrideLoading;

  useEffect(() => {
    if (!businessId || !token || useDefault) return;
    let cancelled = false;
    setOverrideLoading(true);
    getPaymentsOverview(businessId, token, timeFrame)
      .then((d) => {
        if (!cancelled) setOverrideData(d);
      })
      .finally(() => {
        if (!cancelled) setOverrideLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, token, timeFrame, useDefault]);

  if (!businessId) return null;

  const currency = data?.currency ?? features.currency ?? "NGN";
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
          {t("dashboard.paymentsOverview.title")}
        </h2>
        <PeriodPicker defaultValue={timeFrame} sectionKey="payments_overview" />
      </div>

      {loading ? (
        <div className="min-h-[310px] animate-pulse rounded-lg bg-gray-1 dark:bg-dark-2/50" />
      ) : !data ? (
        <ChartEmptyState message={t("dashboard.paymentsOverview.loadError")} />
      ) : !hasData ? (
        <ChartEmptyState message={t("dashboard.paymentsOverview.noData")} />
      ) : (
        <PaymentsOverviewChart data={data} />
      )}

      <dl className="grid divide-stroke text-center dark:divide-dark-3 sm:grid-cols-2 sm:divide-x [&>div]:flex [&>div]:flex-col-reverse [&>div]:gap-1">
        <div className="dark:border-dark-3 max-sm:mb-3 max-sm:border-b max-sm:pb-3">
          <dt className="text-xl font-bold text-dark dark:text-white">
            <Price amount={receivedTotal} currency={currency} />
          </dt>
          <dd className="flex items-center justify-center gap-1.5 font-medium dark:text-dark-6">
            <span className="inline-block size-2.5 rounded-full bg-[#22C55E]" />
            {t("dashboard.paymentsOverview.receivedAmount")}
          </dd>
        </div>
        <div>
          <dt className="text-xl font-bold text-dark dark:text-white">
            <Price amount={dueTotal} currency={currency} />
          </dt>
          <dd className="flex items-center justify-center gap-1.5 font-medium dark:text-dark-6">
            <span className="inline-block size-2.5 rounded-full bg-[#F97316]" />
            {t("dashboard.paymentsOverview.dueAmount")}
          </dd>
        </div>
      </dl>
    </div>
  );
}
