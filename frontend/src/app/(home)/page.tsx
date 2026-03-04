import { PaymentsOverview } from "@/components/Charts/payments-overview";
import { UsedDevices } from "@/components/Charts/used-devices";
import { WeeksProfit } from "@/components/Charts/weeks-profit";
import { TopChannels } from "@/components/Tables/top-channels";
import { TopChannelsSkeleton } from "@/components/Tables/top-channels/skeleton";
import { createTimeFrameExtractor } from "@/utils/timeframe-extractor";
import { Suspense } from "react";
import { OverviewCardsGroupClient } from "./_components/overview-cards/overview-cards-client";
import { ChatsCard } from "./_components/chats-card";
import { RegionLabels } from "./_components/region-labels";
import { DashboardChartsGate } from "./_components/dashboard-charts-gate";

type PropsType = {
  searchParams: Promise<{
    selected_time_frame?: string;
  }>;
};

export default async function Home({ searchParams }: PropsType) {
  const { selected_time_frame } = await searchParams;
  const extractTimeFrame = createTimeFrameExtractor(selected_time_frame);

  return (
    <>
      <OverviewCardsGroupClient />
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href="/invoices"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          + New Invoice
        </a>
        <a
          href="/ledger"
          className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          + Record Transaction
        </a>
        <a
          href="/receipts"
          className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Upload Receipt
        </a>
        <a
          href="/reports"
          className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          View Reports
        </a>
      </div>
      <DashboardChartsGate>
        <div className="mt-4 grid grid-cols-12 gap-4 md:mt-6 md:gap-6 2xl:mt-9 2xl:gap-7.5">
          <PaymentsOverview
            className="col-span-12 xl:col-span-7"
            key={extractTimeFrame("payments_overview")}
            timeFrame={extractTimeFrame("payments_overview")?.split(":")[1]}
          />
          <WeeksProfit
            key={extractTimeFrame("weeks_profit")}
            timeFrame={extractTimeFrame("weeks_profit")?.split(":")[1]}
            className="col-span-12 xl:col-span-5"
          />
          <UsedDevices
            className="col-span-12 xl:col-span-5"
            key={extractTimeFrame("used_devices")}
            timeFrame={extractTimeFrame("used_devices")?.split(":")[1]}
          />
          <RegionLabels />
          <div className="col-span-12 grid xl:col-span-8">
            <Suspense fallback={<TopChannelsSkeleton />}>
              <TopChannels />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <ChatsCard />
          </Suspense>
        </div>
      </DashboardChartsGate>
    </>
  );
}
