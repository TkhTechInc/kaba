"use client";

import { useEffect, useState } from "react";
import { PeriodPicker } from "@/components/period-picker";
import { DonutChart } from "@/components/Charts/used-devices/chart";
import { ChartEmptyState } from "@/components/Charts/chart-empty-state";
import { cn } from "@/lib/utils";
import { getActivityByType } from "@/services/dashboard.service";
import { useAuth } from "@/contexts/auth-context";
import { useDashboardRefresh } from "@/app/(home)/_components/dashboard-refresh-provider";
import { useSearchParams } from "next/navigation";

type PropsType = {
  className?: string;
};

function parseTimeFrame(selected: string | null, sectionKey: string): "monthly" | "yearly" {
  const part = selected?.split(",").find((v) => v.includes(sectionKey));
  const value = part?.split(":")[1];
  return value === "yearly" ? "yearly" : "monthly";
}

export function DashboardActivityByType({ className }: PropsType) {
  const { businessId, token } = useAuth();
  const { refreshTrigger } = useDashboardRefresh();
  const searchParams = useSearchParams();
  const selected = searchParams.get("selected_time_frame");
  const timeFrame = parseTimeFrame(selected, "activity_by_type");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof getActivityByType>>>(null);

  useEffect(() => {
    if (!businessId || !token) {
      setLoading(false);
      setData(null);
      return;
    }
    let cancelled = false;
    getActivityByType(businessId, token, timeFrame)
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

  const hasData = data && data.some((d) => d.amount > 0);

  return (
    <div
      className={cn(
        "col-span-12 xl:col-span-5 grid grid-cols-1 grid-rows-[auto_1fr] gap-9 rounded-[10px] bg-white p-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-body-2xlg font-bold text-dark dark:text-white">
          Activity by Type
        </h2>
        <PeriodPicker defaultValue={timeFrame} sectionKey="activity_by_type" />
      </div>

      <div className="grid place-items-center min-h-[280px]">
        {loading ? (
          <div className="size-full min-h-[280px] animate-pulse rounded-lg bg-gray-1 dark:bg-dark-2/50" />
        ) : !data || data.length === 0 ? (
          <ChartEmptyState message="Unable to load activity data." />
        ) : !hasData ? (
          <ChartEmptyState message="No data yet. Add ledger entries." />
        ) : (
          <DonutChart data={data} centerLabel="Total" />
        )}
      </div>
    </div>
  );
}
