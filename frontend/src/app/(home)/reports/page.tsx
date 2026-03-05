"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { standardFormat } from "@/lib/format-number";
import { createReportsApi } from "@/services/reports.service";
import type { CashFlowSummary, PLReport } from "@/services/reports.service";
import { useEffect, useState } from "react";

const DEFAULT_DAYS = 30;

function getDefaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - DEFAULT_DAYS);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

export default function ReportsPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const canDownloadPdf = features.isEnabled("reports_pdf");
  const [dates, setDates] = useState(getDefaultDates);
  const [pl, setPl] = useState<PLReport | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<"pl" | "cash" | null>(null);

  const api = createReportsApi(token);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.getPL(businessId, dates.fromDate, dates.toDate),
      api.getCashFlow(businessId, dates.fromDate, dates.toDate),
    ])
      .then(([plRes, cfRes]) => {
        setPl(plRes.data);
        setCashFlow(cfRes.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [businessId, dates.fromDate, dates.toDate]);

  const handleDownloadPl = () => {
    if (!businessId) return;
    setDownloading("pl");
    api
      .downloadPLPdf(businessId, dates.fromDate, dates.toDate)
      .catch((e) => setError(e.message))
      .finally(() => setDownloading(null));
  };

  const handleDownloadCashFlow = () => {
    if (!businessId) return;
    setDownloading("cash");
    api
      .downloadCashFlowPdf(businessId, dates.fromDate, dates.toDate)
      .catch((e) => setError(e.message))
      .finally(() => setDownloading(null));
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="Reports" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to view reports.</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName="Reports" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("reports")) {
    return (
      <>
        <Breadcrumb pageName="Reports" />
        <UpgradePrompt feature="Reports" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Reports" />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-body-sm font-medium text-dark dark:text-white">
            From
          </label>
          <input
            type="date"
            value={dates.fromDate}
            onChange={(e) => setDates((d) => ({ ...d, fromDate: e.target.value }))}
            className="rounded-lg border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-body-sm font-medium text-dark dark:text-white">
            To
          </label>
          <input
            type="date"
            value={dates.toDate}
            onChange={(e) => setDates((d) => ({ ...d, toDate: e.target.value }))}
            className="rounded-lg border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red/10 p-4 text-red">{error}</div>
      )}

      {loading ? (
        <div className="rounded-lg border border-stroke bg-white p-12 text-center dark:border-dark-3 dark:bg-gray-dark">
          Loading reports...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {pl && (
            <div className="rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
              <div className="flex items-center justify-between border-b border-stroke px-6 py-4 dark:border-dark-3">
                <h3 className="font-semibold text-dark dark:text-white">
                  Profit & Loss ({pl.period?.start ?? pl.fromDate ?? ""} – {pl.period?.end ?? pl.toDate ?? ""})
                </h3>
                <button
                  type="button"
                  onClick={handleDownloadPl}
                  disabled={!!downloading || !canDownloadPdf}
                  title={!canDownloadPdf ? "Upgrade to download PDF" : undefined}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {downloading === "pl" ? "Downloading..." : "Download PDF"}
                </button>
              </div>
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between gap-4 rounded-lg bg-gray-2 p-4 dark:bg-dark-2">
                  <div>
                    <p className="text-sm text-dark-6">Total Income</p>
                    <p className="text-lg font-semibold text-dark dark:text-white">
                      {pl.currency} {standardFormat(pl.totalIncome ?? pl.revenue ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-6">Total Expenses</p>
                    <p className="text-lg font-semibold text-dark dark:text-white">
                      {pl.currency} {standardFormat(pl.totalExpenses ?? pl.expenses ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-6">Net Profit</p>
                    <p
                      className={`text-lg font-semibold ${
                        (pl.netProfit ?? pl.profit ?? 0) >= 0 ? "text-green-600" : "text-red"
                      }`}
                    >
                      {pl.currency} {standardFormat(pl.netProfit ?? pl.profit ?? 0)}
                    </p>
                  </div>
                </div>
                {(pl.byCategory ?? []).length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(pl.byCategory ?? []).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{row.category}</TableCell>
                          <TableCell className="capitalize">{row.type}</TableCell>
                          <TableCell className="text-right">
                            {pl.currency} {standardFormat(row.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {cashFlow && (
            <div className="rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
              <div className="flex items-center justify-between border-b border-stroke px-6 py-4 dark:border-dark-3">
                <h3 className="font-semibold text-dark dark:text-white">
                  Cash Flow ({cashFlow.period?.start ?? cashFlow.fromDate ?? ""} – {cashFlow.period?.end ?? cashFlow.toDate ?? ""})
                </h3>
                <button
                  type="button"
                  onClick={handleDownloadCashFlow}
                  disabled={!!downloading || !canDownloadPdf}
                  title={!canDownloadPdf ? "Upgrade to download PDF" : undefined}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {downloading === "cash" ? "Downloading..." : "Download PDF"}
                </button>
              </div>
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between gap-4 rounded-lg bg-gray-2 p-4 dark:bg-dark-2">
                  <div>
                    <p className="text-sm text-dark-6">Opening Balance</p>
                    <p className="text-lg font-semibold text-dark dark:text-white">
                      {cashFlow.currency} {standardFormat(cashFlow.openingBalance ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-6">Inflows</p>
                    <p className="text-lg font-semibold text-green-600">
                      {cashFlow.currency} {standardFormat(cashFlow.totalInflows ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-6">Outflows</p>
                    <p className="text-lg font-semibold text-red">
                      {cashFlow.currency} {standardFormat(cashFlow.totalOutflows ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-6">Closing Balance</p>
                    <p className="text-lg font-semibold text-dark dark:text-white">
                      {cashFlow.currency} {standardFormat(cashFlow.closingBalance ?? 0)}
                    </p>
                  </div>
                </div>
                {cashFlow.daily && cashFlow.daily.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Inflow</TableHead>
                        <TableHead className="text-right">Outflow</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashFlow.daily.map((row) => (
                        <TableRow key={row.date}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {cashFlow.currency} {standardFormat(row.inflow ?? row.inflows ?? 0)}
                          </TableCell>
                          <TableCell className="text-right text-red">
                            {cashFlow.currency} {standardFormat(row.outflow ?? row.outflows ?? 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {cashFlow.currency} {standardFormat(row.balance ?? 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
