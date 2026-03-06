"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Price } from "@/components/ui/Price";
import { createDebtsApi, type Debt, type DebtStatus } from "@/services/debts.service";
import { PaginationWithPageSize } from "@/components/ui/pagination-with-page-size";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function DebtsPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | DebtStatus>("all");
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const api = createDebtsApi(token);
  const canRemind = features.isEnabled("debt_reminders");

  const load = () => {
    if (!businessId) return;
    setError(null);
    setLoading(true);
    api
      .list(businessId, page, limit, statusFilter === "all" ? undefined : statusFilter)
      .then((r) => {
        setDebts(r.data.items);
        setTotal(r.data.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [businessId, statusFilter, page, limit]);

  const handleMarkPaid = (id: string) => {
    if (!businessId) return;
    setSubmitting(true);
    api
      .markPaid(businessId, id)
      .then(() => load())
      .catch((e) => setError(e.message))
      .finally(() => setSubmitting(false));
  };

  const handleSendReminder = (id: string) => {
    if (!businessId) return;
    setRemindingId(id);
    setError(null);
    api
      .sendReminder(businessId, id)
      .then((r) => {
        if (r.sent) {
          setError(null);
        } else {
          setError("Failed to send reminder");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setRemindingId(null));
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="People who owe me" />
        <div className="min-w-0 rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to manage debts.</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName="People who owe me" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("debt_tracker")) {
    return (
      <>
        <Breadcrumb pageName="People who owe me" />
        <UpgradePrompt feature="Debt tracker" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="People who owe me" />

      <div className="rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stroke px-4 py-3 sm:px-6 sm:py-4 dark:border-dark-3">
          <h3 className="font-semibold text-dark dark:text-white">Outstanding debts</h3>
          <Link
            href="/debts/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            + Add Debt
          </Link>
        </div>
        {error && (
          <div className="mx-4 mt-2 rounded bg-red/10 p-3 text-sm text-red">{error}</div>
        )}
        <div className="p-4 sm:p-6">
          <div className="mb-4 flex gap-2">
            {(["all", "pending", "overdue", "paid"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  statusFilter === s
                    ? "bg-primary text-white"
                    : "bg-gray-2 text-dark-6 hover:bg-gray-3 dark:bg-dark-2 dark:text-dark-5"
                }`}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : debts.length === 0 ? (
            <p className="py-8 text-center text-dark-6">
              No debts yet.{" "}
              <Link href="/debts/new" className="text-primary hover:underline">
                Add one to get started
              </Link>
              .
            </p>
          ) : (
            <ResponsiveDataList<Debt>
              items={debts}
              keyExtractor={(d) => d.id}
              emptyMessage="No debts yet."
              columns={[
                { key: "name", label: "Name", render: (d) => d.debtorName, prominent: true },
                {
                  key: "amount",
                  label: "Amount",
                  render: (d) => <Price amount={d.amount} currency={d.currency} />,
                  align: "right",
                },
                { key: "due", label: "Due", render: (d) => d.dueDate },
                {
                  key: "status",
                  label: "Status",
                  render: (d) => (
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        d.status === "overdue"
                          ? "bg-red/20 text-red"
                          : d.status === "paid"
                            ? "bg-green/20 text-green"
                            : "bg-amber/20 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {d.status}
                    </span>
                  ),
                },
              ]}
              renderActions={
                (d) =>
                  d.status !== "paid" && (
                    <>
                      {canRemind && d.phone && (
                        <button
                          type="button"
                          onClick={() => handleSendReminder(d.id)}
                          disabled={remindingId === d.id}
                          className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                        >
                          {remindingId === d.id ? "Sending…" : "Send reminder"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleMarkPaid(d.id)}
                        disabled={submitting}
                        className="text-sm font-medium text-green hover:underline disabled:opacity-50"
                      >
                        Mark paid
                      </button>
                    </>
                  )
              }
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
