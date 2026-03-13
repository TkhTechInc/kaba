import { DashboardRefreshProvider } from "./_components/dashboard-refresh-provider";
import { DashboardHomeProvider } from "./_components/dashboard-home-provider";
import { DashboardErrorBanner } from "./_components/dashboard-error-banner";
import { OverviewCardsGroupClient } from "./_components/overview-cards/overview-cards-client";
import { DashboardChartsGate } from "./_components/dashboard-charts-gate";
import { DashboardPaymentsOverview } from "./_components/dashboard-payments-overview";
import { DashboardWeeksProfit } from "./_components/dashboard-weeks-profit";
import { DashboardActivityByType } from "./_components/dashboard-activity-by-type";
import { DashboardRecentInvoices } from "./_components/dashboard-recent-invoices";
import { DashboardDebtsToCollect } from "./_components/dashboard-debts-to-collect";
import { DashboardQuickActions } from "./_components/dashboard-quick-actions";

export default async function Home() {
  return (
    <DashboardRefreshProvider>
      <DashboardHomeProvider>
        <DashboardErrorBanner />
        <OverviewCardsGroupClient />
      <DashboardQuickActions />
      <DashboardChartsGate>
        <div className="mt-4 grid grid-cols-12 gap-4 md:mt-6 md:gap-6 2xl:mt-9 2xl:gap-7.5">
          {/* 1. People who owe me - most urgent for cash flow */}
          <DashboardDebtsToCollect />
          {/* 2. Recent invoices - actionable follow-ups */}
          <DashboardRecentInvoices />
          {/* 3. Payments overview - main cash flow chart */}
          <DashboardPaymentsOverview />
          {/* 4. Weeks profit - sales vs expenses */}
          <DashboardWeeksProfit />
          {/* 5. Activity by type - category breakdown */}
          <DashboardActivityByType />
        </div>
      </DashboardChartsGate>
      </DashboardHomeProvider>
    </DashboardRefreshProvider>
  );
}
