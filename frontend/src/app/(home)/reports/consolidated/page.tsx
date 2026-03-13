"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { useFeatures } from "@/hooks/use-features";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { createReportsApi } from "@/services/reports.service";
import { listOrganizations, type OrganizationAccess } from "@/services/access.service";
import { Price } from "@/components/ui/Price";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { ApiError } from "@/lib/api-client";
import { useState, useEffect } from "react";

export default function ConsolidatedReportPage() {
  const { token, businessId } = useAuth();
  const { t } = useLocale();
  const features = useFeatures(businessId);
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + "-01";

  const [organizations, setOrganizations] = useState<OrganizationAccess[]>([]);
  const [orgId, setOrgId] = useState("");
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [report, setReport] = useState<Awaited<ReturnType<ReturnType<typeof createReportsApi>["getConsolidatedPL"]>>["data"] | null>(null);

  const api = createReportsApi(token);

  useEffect(() => {
    listOrganizations(token ?? undefined)
      .then(setOrganizations)
      .catch(() => setOrganizations([]))
      .finally(() => setLoadingOrgs(false));
  }, [token]);

  const handleLoad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId.trim()) return;
    setLoading(true);
    setError(null);
    api
      .getConsolidatedPL(orgId.trim(), fromDate, toDate)
      .then((r) => setReport(r.data))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : t("reports.consolidated.loadError"));
      })
      .finally(() => setLoading(false));
  };

  const colorClass = (n: number) =>
    n >= 0 ? "text-green-600" : "text-red-600";

  if (!businessId) {
    return (
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
        <Breadcrumb pageName={t("reports.consolidated.breadcrumb")} />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("reports.noBusinessSelected")}</p>
        </div>
      </div>
    );
  }

  if (features.loading) {
    return (
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
        <Breadcrumb pageName={t("reports.consolidated.breadcrumb")} />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!features.isEnabled("reports")) {
    return (
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
        <Breadcrumb pageName={t("reports.consolidated.breadcrumb")} />
        <UpgradePrompt feature="Reports" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
        <Breadcrumb pageName={t("reports.consolidated.breadcrumb")} />
        <PermissionDenied resource="Consolidated Reports" backHref="/reports" backLabel="Back to Reports" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <Breadcrumb pageName={t("reports.consolidated.breadcrumb")} />

      <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">
          {t("reports.consolidated.heading")}
        </h2>

        <form onSubmit={handleLoad} className="mb-6 flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="org-select" className="sr-only">
              {t("reports.consolidated.selectOrg")}
            </label>
            <select
              id="org-select"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              disabled={loadingOrgs}
              className="w-full rounded border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white disabled:opacity-60"
            >
              <option value="">
                {loadingOrgs
                  ? t("reports.consolidated.loadingOrgs")
                  : organizations.length === 0
                    ? t("reports.consolidated.noOrgs")
                    : t("reports.consolidated.selectOrg")}
              </option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
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
            {loading ? t("common.loading") : t("reports.consolidated.loadReport")}
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
                <p className="text-sm text-gray-500">{t("reports.pl.totalIncome")}</p>
                <p className="text-xl font-bold text-green-600">
                  <Price amount={report.totalIncome} currency={report.currency} />
                </p>
              </div>
              <div className="rounded-lg border border-stroke p-4 dark:border-dark-3">
                <p className="text-sm text-gray-500">{t("reports.pl.totalExpenses")}</p>
                <p className="text-xl font-bold text-red-600">
                  <Price amount={report.totalExpenses} currency={report.currency} />
                </p>
              </div>
              <div className="rounded-lg border border-stroke p-4 dark:border-dark-3">
                <p className="text-sm text-gray-500">{t("reports.pl.netProfit")}</p>
                <p className={`text-xl font-bold ${colorClass(report.netProfit)}`}>
                  <Price amount={report.netProfit} currency={report.currency} />
                </p>
              </div>
            </div>

            {/* Per-branch breakdown */}
            <h3 className="mb-3 font-semibold text-dark dark:text-white">{t("reports.consolidated.branchBreakdown")}</h3>
            <ResponsiveDataList<typeof report.branches[0]>
              items={report.branches}
              keyExtractor={(b) => b.businessId}
              emptyMessage={t("reports.consolidated.noBranches")}
              columns={[
                {
                  key: "branch",
                  label: t("reports.consolidated.branch"),
                  render: (b) => (
                    <>
                      <div className="font-medium">{b.businessName ?? "—"}</div>
                      <div className="text-xs text-gray-400 font-mono">{b.businessId}</div>
                    </>
                  ),
                  prominent: true,
                },
                {
                  key: "income",
                  label: t("reports.consolidated.income"),
                  render: (b) => (
                    <span className="text-green-600">
                      <Price amount={b.report.totalIncome ?? 0} currency={b.report.currency} />
                    </span>
                  ),
                  align: "right",
                },
                {
                  key: "expenses",
                  label: t("reports.consolidated.expenses"),
                  render: (b) => (
                    <span className="text-red-600">
                      <Price amount={b.report.totalExpenses ?? 0} currency={b.report.currency} />
                    </span>
                  ),
                  align: "right",
                },
                {
                  key: "netProfit",
                  label: t("reports.pl.netProfit"),
                  render: (b) => {
                    const income = b.report.totalIncome ?? 0;
                    const expenses = b.report.totalExpenses ?? 0;
                    const netProfit = b.report.netProfit ?? (income - expenses);
                    return (
                      <span className={colorClass(netProfit)}>
                        <Price amount={netProfit} currency={b.report.currency} />
                      </span>
                    );
                  },
                  align: "right",
                },
              ]}
            />
          </>
        )}
      </div>
    </div>
  );
}
