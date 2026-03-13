"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Price } from "@/components/ui/Price";
import { createLedgerApi, type LedgerEntry } from "@/services/ledger.service";
import { PaginationWithPageSize } from "@/components/ui/pagination-with-page-size";
import { DateRangeFilter, type DateRange } from "@/components/ui/date-range-filter";
import { ListSearchInput } from "@/components/ui/list-search-input";
import Link from "next/link";
import { useLocale } from "@/contexts/locale-context";
import { useEffect, useState } from "react";
import { VoiceEntryButton } from "@/components/ui/VoiceEntryButton";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { ApiError } from "@/lib/api-client";

export default function LedgerPage() {
  const { t } = useLocale();
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const permissions = usePermissions(businessId);
  const canWrite = permissions.ledger.canWrite;
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [balance, setBalance] = useState<{
    balance: number;
    currency: string;
  } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "sale" | "expense">(
    "all"
  );
  const [dateRange, setDateRange] = useState<DateRange>({ fromDate: "", toDate: "" });
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const api = createLedgerApi(token);

  useEffect(() => {
    if (!businessId) return;
    setError(null);
    setLoading(true);
    api
      .listEntries(businessId, page, limit, typeFilter, dateRange.fromDate || undefined, dateRange.toDate || undefined)
      .then((r) => {
        setEntries(r.data.items);
        setTotal(r.data.total);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : "Failed to load entries");
      })
      .finally(() => setLoading(false));
  }, [businessId, page, limit, typeFilter, dateRange]);

  useEffect(() => {
    if (!businessId) return;
    setBalanceLoading(true);
    api
      .getBalance(businessId)
      .then((r) => setBalance(r.data))
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [businessId]);

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName={t("ledger.title")} />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("ledger.noBusinessSelected")}</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName={t("ledger.title")} />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("ledger")) {
    return (
      <>
        <Breadcrumb pageName={t("ledger.title")} />
        <UpgradePrompt feature="Ledger" />
      </>
    );
  }

  if (forbidden) {
    return (
      <>
        <Breadcrumb pageName={t("ledger.title")} />
        <PermissionDenied resource="Ledger" backHref="/" backLabel="Go to Dashboard" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName={t("ledger.title")} />

      {voiceError && (
        <div className="mb-4 rounded bg-red/10 p-3 text-sm text-red">
          {voiceError}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded bg-red/10 p-3 text-sm text-red">
          {error}
        </div>
      )}

      {(balance != null || balanceLoading) && (
        <div
          className={`mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border px-6 py-4 dark:border-dark-3 ${
            balance != null && balance.balance < 0
              ? "border-red/30 bg-red/5 dark:border-red/20 dark:bg-red/10"
              : "border-stroke bg-white dark:bg-gray-dark"
          }`}
        >
          <div>
            <p className="text-sm font-medium text-dark-6 dark:text-dark-5">
              {t("ledger.balance.label")}
            </p>
            {balanceLoading ? (
              <div className="mt-1 flex items-center gap-2 text-dark-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>{t("ledger.balance.loading")}</span>
              </div>
            ) : balance != null ? (
              <p className="text-2xl font-bold text-dark dark:text-white">
                <Price amount={balance.balance} currency={balance.currency} />
              </p>
            ) : (
              <p className="text-lg text-dark-6">—</p>
            )}
          </div>
        </div>
      )}

      <div className="min-w-0 rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stroke px-4 py-3 dark:border-dark-3 sm:px-6 sm:py-4">
          <h3 className="font-semibold text-dark dark:text-white">
            {t("ledger.entries.title")}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <ListSearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("ledger.entries.search")}
            />
            <DateRangeFilter
              value={dateRange}
              onChange={(r) => { setDateRange(r); setPage(1); }}
              onClear={() => { setDateRange({ fromDate: "", toDate: "" }); setPage(1); }}
            />
            {canWrite && (
              <>
                <VoiceEntryButton
                  token={token}
                  businessId={businessId}
                  onSuccess={() => {
                    // Refresh list and balance after voice entry is saved
                    setPage(1);
                    setVoiceError(null);
                    api.listEntries(businessId, 1, limit, typeFilter).then((r) => {
                      setEntries(r.data.items);
                      setTotal(r.data.total);
                    }).catch(() => null);
                    api.getBalance(businessId).then((r) => setBalance(r.data)).catch(() => null);
                  }}
                  onError={(msg) => setVoiceError(msg)}
                />
                <Link
                  href="/ledger/entries/new"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                >
                  {t("ledger.entries.newEntry")}
                </Link>
              </>
            )}
          </div>
        </div>

        <div
          className="flex gap-1 border-b border-stroke px-6 py-2 dark:border-dark-3"
          role="tablist"
          aria-label="Filter by transaction type"
        >
          {(["all", "sale", "expense"] as const).map((filterVal) => (
            <button
              key={filterVal}
              role="tab"
              aria-selected={typeFilter === filterVal}
              onClick={() => { setTypeFilter(filterVal); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                typeFilter === filterVal
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-dark-4 hover:bg-gray-200 dark:bg-dark-2 dark:text-dark-6 dark:hover:bg-dark-3"
              }`}
            >
              {filterVal === "all" ? t("ledger.filter.all") : filterVal === "sale" ? t("ledger.filter.sale") : t("ledger.filter.expense")}
            </button>
          ))}
        </div>

        <div className="-mx-4 sm:mx-0">
          {loading ? (
            <div className="p-6 text-center text-dark-6" role="status" aria-live="polite">
              {t("ledger.entries.loading")}
            </div>
          ) : (
            <ResponsiveDataList<LedgerEntry>
              items={
                search.trim()
                  ? entries.filter(
                      (e) =>
                        (e.description ?? "").toLowerCase().includes(search.trim().toLowerCase()) ||
                        (e.category ?? "").toLowerCase().includes(search.trim().toLowerCase()) ||
                        (e.type ?? "").toLowerCase().includes(search.trim().toLowerCase()) ||
                        (e.date ?? "").toLowerCase().includes(search.trim().toLowerCase()) ||
                        e.amount.toString().includes(search.trim())
                    )
                  : entries
              }
              keyExtractor={(e) => e.id}
              emptyMessage={
                search.trim() ? (
                  t("ledger.entries.noResults")
                ) : canWrite ? (
                  <>
                    {t("ledger.entries.empty")}{" "}
                    <Link href="/ledger/entries/new" className="text-primary hover:underline">
                      {t("ledger.entries.emptyCta")}
                    </Link>
                  </>
                ) : (
                  t("ledger.entries.empty")
                )
              }
              columns={[
                { key: "date", label: t("ledger.column.date"), render: (e) => e.date, prominent: true },
                {
                  key: "type",
                  label: t("ledger.column.type"),
                  render: (e) => (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        e.type === "sale"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                      }`}
                    >
                      {e.type === "sale" ? t("ledger.type.sale") : t("ledger.type.expense")}
                    </span>
                  ),
                },
                { key: "description", label: t("ledger.column.description"), render: (e) => e.description || "—" },
                { key: "category", label: t("ledger.column.category"), render: (e) => e.category || "—" },
                {
                  key: "amount",
                  label: t("ledger.column.amount"),
                  render: (e) => (
                    <>
                      {e.type === "expense" ? "-" : ""}
                      <Price amount={e.amount} currency={e.currency} />
                    </>
                  ),
                  align: "right",
                },
              ]}
            />
          )}
        </div>

        <PaginationWithPageSize
          page={page}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
          showWhenTotalExceeds={0}
        />
      </div>
    </>
  );
}
