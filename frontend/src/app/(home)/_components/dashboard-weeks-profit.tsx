"use client";

import { useEffect, useState } from "react";
import { PeriodPicker } from "@/components/period-picker";
import { WeeksProfitChart } from "@/components/Charts/weeks-profit/chart";
import { ChartEmptyState } from "@/components/Charts/chart-empty-state";
import { cn } from "@/lib/utils";
import { getWeeksProfit } from "@/services/dashboard.service";
import { useAuth } from "@/contexts/auth-context";
import { useDashboardRefresh } from "@/app/(home)/_components/dashboard-refresh-provider";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/contexts/locale-context";

type PropsType = {
  className?: string;
};

function parseTimeFrame(selected: string | null, sectionKey: string): "this week" | "last week" {
  const part = selected?.split(",").find((v) => v.includes(sectionKey));
  const value = part?.split(":")[1];
  return value === "last week" ? "last week" : "this week";
}

export function DashboardWeeksProfit({ className }: PropsType) {
  const { businessId, token } = useAuth();
  const { refreshTrigger } = useDashboardRefresh();
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const selected = searchParams.get("selected_time_frame");
  const timeFrame = parseTimeFrame(selected, "weeks_profit");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof getWeeksProfit>>>(null);

  useEffect(() => {
    if (!businessId || !token) {
      setLoading(false);
      setData(null);
      return;
    }
    let cancelled = false;
    getWeeksProfit(businessId, token, timeFrame)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, token, timeFrame, refreshTrigger]);

  if (!businessId) return null;

  const hasData =
    data &&
    (data.sales.some((d) => d.y > 0) || data.revenue.some((d) => d.y > 0));

  return (
    <div
      className={cn(
        "col-span-12 xl:col-span-5 rounded-[10px] bg-white px-7.5 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-body-2xlg font-bold text-dark dark:text-white">
          {t("dashboard.weeksProfit.title", { timeFrame: t(`dashboard.weeksProfit.${timeFrame === "this week" ? "thisWeek" : "lastWeek"}`) })}
        </h2>
        <PeriodPicker
          items={["this week", "last week"]}
          defaultValue={timeFrame}
          sectionKey="weeks_profit"
        />
      </div>

      {loading ? (
        <div className="mt-3 min-h-[370px] animate-pulse rounded-lg bg-gray-1 dark:bg-dark-2/50" />
      ) : !data ? (
        <ChartEmptyState
          className="mt-3"
          message={t("dashboard.weeksProfit.loadError")}
        />
      ) : !hasData ? (
        <ChartEmptyState
          className="mt-3"
          message={t("dashboard.weeksProfit.noData")}
        />
      ) : (
        <WeeksProfitChart data={data} />
      )}
    </div>
  );
}
