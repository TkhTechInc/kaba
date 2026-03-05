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
import { createReportsApi } from "@/services/reports.service";
import { standardFormat } from "@/lib/format-number";
import { useState } from "react";

export default function ConsolidatedReportPage() {
  const { token, businessId } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + "-01";

  const [orgId, setOrgId] = useState("");
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Awaited<ReturnType<ReturnType<typeof createReportsApi>["getConsolidatedPL"]>>["data"] | null>(null);

  const api = createReportsApi(token);

  const handleLoad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId.trim()) return;
    setLoading(true);
    setError(null);
    api
      .getConsolidatedPL(orgId.trim(), fromDate, toDate)
      .then((r) => setReport(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const colorClass = (n: number) =>
    n >= 0 ? "text-green-600" : "text-red-600";

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <Breadcrumb pageName="Consolidated P&L" />

      <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">
          Multi-Branch Consolidated Report
        </h2>

        <form onSubmit={handleLoad} className="mb-6 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Organization ID"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="flex-1 min-w-[200px] rounded border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white"
          />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white"
          />
          <button
            type="submit"
            disabled={loading || !orgId.trim()}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load Report"}
          </button>
        </form>

        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {report && (
          <>
            {/* Summary cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-stroke p-4 dark:border-dark-3">
                <p className="text-sm text-gray-500">Total Income</p>
                <p className="text-xl font-bold text-green-600">
                  {report.currency} {standardFormat(report.totalIncome)}
                </p>
              </div>
              <div className="rounded-lg border border-stroke p-4 dark:border-dark-3">
                <p className="text-sm text-gray-500">Total Expenses</p>
                <p className="text-xl font-bold text-red-600">
                  {report.currency} {standardFormat(report.totalExpenses)}
                </p>
              </div>
              <div className="rounded-lg border border-stroke p-4 dark:border-dark-3">
                <p className="text-sm text-gray-500">Net Profit</p>
                <p className={`text-xl font-bold ${colorClass(report.netProfit)}`}>
                  {report.currency} {standardFormat(report.netProfit)}
                </p>
              </div>
            </div>

            {/* Per-branch breakdown */}
            <h3 className="mb-3 font-semibold text-dark dark:text-white">Branch Breakdown</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Income</TableHead>
                  <TableHead>Expenses</TableHead>
                  <TableHead>Net Profit</TableHead>
                </TableRow>
              </TableHeader>
                  <TableBody>
                {report.branches.map((branch) => {
                  const income = branch.report.totalIncome ?? 0;
                  const expenses = branch.report.totalExpenses ?? 0;
                  const netProfit = branch.report.netProfit ?? (income - expenses);
                  return (
                  <TableRow key={branch.businessId}>
                    <TableCell>
                      <div className="font-medium">{branch.businessName ?? "—"}</div>
                      <div className="text-xs text-gray-400 font-mono">{branch.businessId}</div>
                    </TableCell>
                    <TableCell className="text-green-600">
                      {branch.report.currency} {standardFormat(income)}
                    </TableCell>
                    <TableCell className="text-red-600">
                      {branch.report.currency} {standardFormat(expenses)}
                    </TableCell>
                    <TableCell className={colorClass(netProfit)}>
                      {branch.report.currency} {standardFormat(netProfit)}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </div>
  );
}
