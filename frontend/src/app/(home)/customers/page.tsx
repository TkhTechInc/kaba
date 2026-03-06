"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import {
  createInvoicesApi,
  type Customer,
} from "@/services/invoices.service";
import { createReportsApi } from "@/services/reports.service";
import { PaginationWithPageSize } from "@/components/ui/pagination-with-page-size";
import { useEffect, useState } from "react";
import Link from "next/link";

type CreditScoreData = {
  trustScore: number;
  recommendation: 'approve' | 'review' | 'deny';
  breakdown: {
    transactionFrequency: number;
    debtRepaymentRatio: number;
    volumeConsistency: number;
  };
};

export default function CustomersPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditModal, setCreditModal] = useState<{ customerId: string; name: string } | null>(null);
  const [creditScore, setCreditScore] = useState<CreditScoreData | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);

  const api = createInvoicesApi(token);
  const reportsApi = createReportsApi(token);

  const openCreditScore = async (customer: Customer) => {
    if (!businessId) return;
    setCreditModal({ customerId: customer.id, name: customer.name });
    setCreditScore(null);
    setCreditError(null);
    setCreditLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
      const r = await reportsApi.getCreditScore(businessId, customer.id, sixMonthsAgo, today);
      setCreditScore(r.data);
    } catch (e: unknown) {
      setCreditError(e instanceof Error ? e.message : "Failed to load credit score");
    } finally {
      setCreditLoading(false);
    }
  };

  const load = () => {
    if (!businessId) return;
    setError(null);
    setLoading(true);
    api
      .listCustomers(businessId, page, limit)
      .then((r) => {
        setCustomers(r.data.items);
        setTotal(r.data.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [businessId, page, limit]);

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="Customers" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to manage customers.</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName="Customers" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("invoicing")) {
    return (
      <>
        <Breadcrumb pageName="Customers" />
        <UpgradePrompt feature="Invoicing" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Customers" />

      <div className="rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stroke px-4 py-3 sm:px-6 sm:py-4 dark:border-dark-3">
          <h3 className="font-semibold text-dark dark:text-white">
            Customers
          </h3>
          <Link
            href="/customers/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            + Add Customer
          </Link>
        </div>
            <div className="-mx-4 sm:mx-0">
              {loading ? (
                <div className="p-6 text-center text-dark-6">Loading...</div>
              ) : (
                <ResponsiveDataList<Customer>
                  items={customers}
                  keyExtractor={(c) => c.id}
                  emptyMessage={
                    <span>
                      No customers yet.{" "}
                      <Link href="/customers/new" className="text-primary hover:underline">
                        Add one to get started
                      </Link>
                      .
                    </span>
                  }
                  columns={[
                    { key: "name", label: "Name", render: (c) => c.name, prominent: true },
                    { key: "email", label: "Email", render: (c) => c.email ?? "—" },
                    { key: "phone", label: "Phone", render: (c) => c.phone ?? "—" },
                    {
                      key: "trust",
                      label: "Trust Score",
                      render: (c) => (
                        <button
                          type="button"
                          onClick={() => openCreditScore(c)}
                          className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                        >
                          View Score
                        </button>
                      ),
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

      {/* Credit Score Modal */}
      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-dark dark:text-white">
                Trust Score — {creditModal.name}
              </h3>
              <button
                onClick={() => { setCreditModal(null); setCreditScore(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {creditLoading && (
              <p className="py-8 text-center text-gray-500">Calculating score…</p>
            )}
            {creditError && (
              <p className="text-sm text-red-600">{creditError}</p>
            )}
            {creditScore && (
              <div className="space-y-4">
                {/* Score dial */}
                <div className="flex flex-col items-center py-4">
                  <div
                    className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white ${
                      creditScore.trustScore >= 70
                        ? "bg-green-500"
                        : creditScore.trustScore >= 40
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  >
                    {creditScore.trustScore}
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-600">Trust Score / 100</p>
                  <span
                    className={`mt-1 rounded-full px-3 py-0.5 text-sm font-semibold capitalize ${
                      creditScore.recommendation === "approve"
                        ? "bg-green-100 text-green-800"
                        : creditScore.recommendation === "review"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {creditScore.recommendation === "approve"
                      ? "✓ Approve Credit"
                      : creditScore.recommendation === "review"
                      ? "⚠ Review Manually"
                      : "✗ Deny Credit"}
                  </span>
                </div>

                {/* Breakdown */}
                <div className="space-y-2 border-t pt-4">
                  {[
                    { label: "Transaction Frequency", value: creditScore.breakdown.transactionFrequency },
                    { label: "Debt Repayment Ratio", value: creditScore.breakdown.debtRepaymentRatio },
                    { label: "Volume Consistency", value: creditScore.breakdown.volumeConsistency },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="mb-1 flex justify-between text-xs text-gray-600">
                        <span>{label}</span>
                        <span>{value}/100</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
