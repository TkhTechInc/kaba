"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { useFeatures } from "@/hooks/use-features";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import {
  createInvoicesApi,
  type Customer,
} from "@/services/invoices.service";
import { PaginationWithPageSize } from "@/components/ui/pagination-with-page-size";
import { DateRangeFilter, type DateRange } from "@/components/ui/date-range-filter";
import { ListSearchInput } from "@/components/ui/list-search-input";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { ApiError } from "@/lib/api-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function CustomersPage() {
  const { token, businessId } = useAuth();
  const { t } = useLocale();
  const features = useFeatures(businessId);
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ fromDate: "", toDate: "" });
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");

  const api = useMemo(() => createInvoicesApi(token), [token]);

  const load = useCallback(() => {
    if (!businessId) return;
    setError(null);
    setLoading(true);
    api
      .listCustomers(businessId, page, limit, dateRange.fromDate || undefined, dateRange.toDate || undefined)
      .then((r) => {
        setCustomers(r.data.items);
        setTotal(r.data.total);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : t("errors.loadCustomers"));
      })
      .finally(() => setLoading(false));
  }, [businessId, page, limit, dateRange, api, t]);

  useEffect(() => {
    load();
  }, [load, searchParams.get("search")]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && businessId) {
        load();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [load, businessId]);

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName={t("customers.title")} />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("customers.noBusinessSelected")}</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName={t("customers.title")} />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("invoicing")) {
    return (
      <>
        <Breadcrumb pageName={t("customers.title")} />
        <UpgradePrompt feature="Invoicing" />
      </>
    );
  }

  if (forbidden) {
    return (
      <>
        <Breadcrumb pageName={t("customers.title")} />
        <PermissionDenied resource={t("permissionDenied.resource.customers")} backHref="/" backLabel={t("common.goToDashboard")} />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName={t("customers.title")} />

      <div className="rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stroke px-4 py-3 sm:px-6 sm:py-4 dark:border-dark-3">
          <h3 className="font-semibold text-dark dark:text-white">
            {t("customers.title")}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <ListSearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("customers.search")}
            />
            <DateRangeFilter
              value={dateRange}
              onChange={(r) => { setDateRange(r); setPage(1); }}
              onClear={() => { setDateRange({ fromDate: "", toDate: "" }); setPage(1); }}
            />
            <Link
              href="/customers/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {t("customers.addCustomer")}
            </Link>
          </div>
        </div>
            <div className="-mx-4 sm:mx-0">
              {loading ? (
                <div className="p-6 text-center text-dark-6">{t("customers.loading")}</div>
              ) : (
                <ResponsiveDataList<Customer>
                  items={
                    search.trim()
                      ? customers.filter(
                          (c) =>
                            c.name.toLowerCase().includes(search.trim().toLowerCase()) ||
                            (c.email ?? "").toLowerCase().includes(search.trim().toLowerCase()) ||
                            (c.phone ?? "").toLowerCase().includes(search.trim().toLowerCase())
                        )
                      : customers
                  }
                  keyExtractor={(c) => c.id}
                  emptyMessage={
                    search.trim() ? (
                      t("customers.noResults")
                    ) : (dateRange.fromDate || dateRange.toDate) ? (
                      <span>
                        {t("customers.dateFilterHint")}{" "}
                        <button
                          type="button"
                          onClick={() => { setDateRange({ fromDate: "", toDate: "" }); setPage(1); }}
                          className="text-primary hover:underline"
                        >
                          {t("dateFilter.clear")}
                        </button>
                      </span>
                    ) : (
                      <span>
                        {t("customers.empty")}{" "}
                        <Link href="/customers/new" className="text-primary hover:underline">
                          {t("customers.emptyCta")}
                        </Link>
                        .
                      </span>
                    )
                  }
                  columns={[
                    { key: "name", label: t("customers.column.name"), render: (c) => c.name, prominent: true },
                    { key: "email", label: t("customers.column.email"), render: (c) => c.email ?? "—" },
                    { key: "phone", label: t("customers.column.phone"), render: (c) => c.phone ?? "—" },
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
