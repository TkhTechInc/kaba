import { ArrowDownIcon, ArrowUpIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";
import type { JSX, SVGProps } from "react";

type PropsType = {
  label: string;
  data: {
    value: number | string;
    growthRate?: number;
  };
  Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
};

export function OverviewCard({ label, data, Icon }: PropsType) {
  const growthRate = data.growthRate;
  const showGrowth = typeof growthRate === "number";
  const isDecreasing = showGrowth && growthRate < 0;

  return (
    <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark">
      <div className="flex items-center gap-4">
        {/* Icon scaled down to sit inline with the label */}
        <div className="shrink-0 [&>svg]:h-11 [&>svg]:w-11">
          <Icon />
        </div>

        <dl className="min-w-0 flex-1">
          <dd className="mb-0.5 truncate text-sm font-medium text-dark-6">{label}</dd>
          <dt className="text-xl font-bold text-dark dark:text-white">
            {data.value}
          </dt>
        </dl>

        {showGrowth && (
          <dl
            className={cn(
              "shrink-0 text-sm font-medium",
              isDecreasing ? "text-red" : "text-green",
            )}
          >
            <dt className="flex items-center gap-1">
              {isDecreasing ? (
                <ArrowDownIcon aria-hidden />
              ) : (
                <ArrowUpIcon aria-hidden />
              )}
              {growthRate}%
            </dt>
            <dd className="sr-only">
              {label} {isDecreasing ? "Decreased" : "Increased"} by {growthRate}%
            </dd>
          </dl>
        )}
      </div>
    </div>
  );
}
