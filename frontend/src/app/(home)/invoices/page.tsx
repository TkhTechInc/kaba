"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { useFeatures } from "@/hooks/use-features";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Price } from "@/components/ui/Price";
import { createInvoicesApi, type Invoice } from "@/services/invoices.service";
import { PaginationWithPageSize } from "@/components/ui/pagination-with-page-size";
import { DateRangeFilter, type DateRange } from "@/components/ui/date-range-filter";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { ApiError } from "@/lib/api-client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function InvoicesPage() {
  const { token, businessId } = useAuth();
  const { t } = useLocale();
  const features = useFeatures(businessId);
  const [invoices, setInvoices] = useState<
    Awaited<ReturnType<ReturnType<typeof createInvoicesApi>["list"]>>["data"]["items"]
  >([]);
  const [customers, setCustomers] = useState<
    Awaited<ReturnType<ReturnType<typeof createInvoicesApi>["listCustomers"]>>["data"]["items"]
  >([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [paymentLinkId, setPaymentLinkId] = useState<string | null>(null);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "sent" | "paid" | "overdue">("all");
  const [dateRange, setDateRange] = useState<DateRange>({ fromDate: "", toDate: "" });

  const api = createInvoicesApi(token);

  useEffect(() => {
    if (!businessId) return;
    setError(null);
    setLoading(true);
    api
      .list(businessId, page, limit, statusFilter === "all" ? undefined : statusFilter, dateRange.fromDate || undefined, dateRange.toDate || undefined)
      .then((r) => {
        setInvoices(r.data.items);
        setTotal(r.data.total);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : "Failed to load invoices");
      })
      .finally(() => setLoading(false));
  }, [businessId, page, limit, statusFilter, dateRange]);

  useEffect(() => {
    if (!businessId) return;
    api
      .listCustomers(businessId, 1, 100)
      .then((r) => setCustomers(r.data.items))
      .catch(() => setCustomers([]));
  }, [businessId]);

  const generatePaymentLink = (id: string) => {
    if (!businessId) return;
    api
      .generatePaymentLink(id, businessId)
      .then((r) => {
        setPaymentLinkId(id);
        setPaymentLinkUrl(r.paymentUrl);
      })
      .catch((e) => setError(e.message));
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName={t("invoices.title")} />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("invoices.noBusinessSelected")}</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName={t("invoices.title")} />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("invoicing")) {
    return (
      <>
        <Breadcrumb pageName={t("invoices.title")} />
        <UpgradePrompt feature="Invoicing" />
      </>
    );
  }

  if (forbidden) {
    return (
      <>
        <Breadcrumb pageName={t("invoices.title")} />
        <PermissionDenied resource="Invoices" backHref="/" backLabel="Go to Dashboard" />
      </>
    );
  }

  const filterLabels: Record<"all" | "draft" | "sent" | "paid" | "overdue", string> = {
    all: t("invoices.filter.all"),
    draft: t("invoices.filter.draft"),
    sent: t("invoices.filter.sent"),
    paid: t("invoices.filter.paid"),
    overdue: t("invoices.filter.overdue"),
  };

  return (
    <>
      <Breadcrumb pageName={t("invoices.title")} />

      <div className="rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stroke px-6 py-4 dark:border-dark-3">
          <h3 className="font-semibold text-dark dark:text-white">{t("invoices.title")}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter
              value={dateRange}
              onChange={(r) => { setDateRange(r); setPage(1); }}
              onClear={() => { setDateRange({ fromDate: "", toDate: "" }); setPage(1); }}
            />
            <Link
              href="/invoices/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {t("invoices.newInvoice")}
            </Link>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-stroke px-6 py-2 dark:border-dark-3" role="tablist" aria-label={t("invoices.title")}>
              {(["all", "draft", "sent", "paid", "overdue"] as const).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={statusFilter === s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                    statusFilter === s
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-dark-4 hover:bg-gray-200 dark:bg-dark-2 dark:text-dark-6 dark:hover:bg-dark-3"
                  }`}
                >
                  {filterLabels[s]}
                </button>
              ))}
        </div>
        <div className="-mx-4 sm:mx-0">
              {loading ? (
                <div className="p-6 text-center text-dark-6">{t("invoices.loading")}</div>
              ) : (
                <ResponsiveDataList<Invoice>
                  items={invoices}
                  keyExtractor={(inv) => inv.id}
                  emptyMessage={t("invoices.empty")}
                  columns={[
                    {
                      key: "customer",
                      label: t("invoices.column.customer"),
                      render: (inv) => customers.find((c) => c.id === inv.customerId)?.name ?? inv.customerId,
                      prominent: true,
                    },
                    { key: "dueDate", label: t("invoices.column.dueDate"), render: (inv) => inv.dueDate },
                    {
                      key: "status",
                      label: t("invoices.column.status"),
                      render: (inv) => (
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                              inv.status === "paid"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                : inv.status === "overdue"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                  : inv.status === "sent"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                    : inv.status === "pending_approval"
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                                      : "bg-gray-100 text-gray-700 dark:bg-dark-2 dark:text-dark-6"
                            }`}
                          >
                            {inv.status === "pending_approval"
                              ? t("invoices.status.pendingApproval")
                              : t(`invoices.filter.${inv.status}` as Parameters<typeof t>[0]) || inv.status}
                          </span>
                          {inv.mecefStatus === "confirmed" && (
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800" title={`MECeF Serial: ${inv.mecefSerialNumber ?? ""}`}>
                              ✓ DGI {inv.mecefSerialNumber ? `#${inv.mecefSerialNumber.slice(-8)}` : "Certified"}
                            </span>
                          )}
                          {inv.mecefStatus === "pending" && (
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">{t("invoices.status.dgiPending")}</span>
                          )}
                          {inv.mecefStatus === "rejected" && (
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">{t("invoices.status.dgiRejected")}</span>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: "amount",
                      label: t("invoices.column.amount"),
                      render: (inv) => <Price amount={inv.amount} currency={inv.currency} />,
                      align: "right",
                    },
                  ]}
                  renderActions={(inv) => (
                    <>
                      <Link href={`/invoices/${inv.id}/edit`} className="text-sm font-medium text-primary hover:underline">
                        {t("invoices.action.edit")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => generatePaymentLink(inv.id)}
                        className="text-sm font-medium text-primary hover:underline"
                        aria-label={t("invoices.action.paymentLinkAriaLabel", { id: inv.id })}
                      >
                        {t("invoices.action.paymentLink")}
                      </button>
                    </>
                  )}
                />
              )}
        </div>
        {paymentLinkUrl && paymentLinkId && (
              <div className="border-t border-stroke p-4 dark:border-dark-3">
                <p className="mb-2 text-sm font-medium">{t("invoices.paymentLinkLabel")}</p>
                <a
                  href={paymentLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-primary hover:underline"
                >
                  {paymentLinkUrl}
                </a>
          </div>
        )}
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
