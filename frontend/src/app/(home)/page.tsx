import Link from "next/link";
import { DashboardRefreshProvider } from "./_components/dashboard-refresh-provider";
import { OverviewCardsGroupClient } from "./_components/overview-cards/overview-cards-client";
import { DashboardChartsGate } from "./_components/dashboard-charts-gate";
import { DashboardPaymentsOverview } from "./_components/dashboard-payments-overview";
import { DashboardWeeksProfit } from "./_components/dashboard-weeks-profit";
import { DashboardActivityByType } from "./_components/dashboard-activity-by-type";
import { DashboardRecentInvoices } from "./_components/dashboard-recent-invoices";
import { DashboardDebtsToCollect } from "./_components/dashboard-debts-to-collect";

export default async function Home() {
  return (
    <DashboardRefreshProvider>
      <OverviewCardsGroupClient />
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          + New Invoice
        </Link>
        <Link
          href="/ledger"
          className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          + Record Transaction
        </Link>
        <Link
          href="/receipts"
          className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Upload Receipt
        </Link>
        <Link
          href="/reports"
          className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          View Reports
        </Link>
      </div>
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
    </DashboardRefreshProvider>
  );
}
