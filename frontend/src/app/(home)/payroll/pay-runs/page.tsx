"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Price } from "@/components/ui/Price";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { ApiError } from "@/lib/api-client";
import { createPayrollApi, type PayRun } from "@/services/payroll.service";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function PayRunsPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const [payRuns, setPayRuns] = useState<PayRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [periodMonth, setPeriodMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const api = createPayrollApi(token);
  const payrollEnabled = features.isEnabled("payroll");

  const load = () => {
    if (!businessId) return;
    setLoading(true);
    api
      .listPayRuns(businessId)
      .then((r) => setPayRuns(r.data ?? []))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [businessId]);

  const handleCreate = () => {
    if (!businessId) return;
    setSubmitting(true);
    setError(null);
    api
      .createPayRun(businessId, periodMonth)
      .then(() => load())
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Create failed"))
      .finally(() => setSubmitting(false));
  };

  const handleFinalize = (id: string) => {
    if (!businessId) return;
    setSubmitting(true);
    setError(null);
    api
      .finalizePayRun(businessId, id)
      .then(() => load())
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Finalize failed"))
      .finally(() => setSubmitting(false));
  };

  const handlePay = (id: string) => {
    if (!businessId) return;
    setSubmitting(true);
    setError(null);
    api
      .payPayRun(businessId, id)
      .then(() => load())
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Pay failed"))
      .finally(() => setSubmitting(false));
  };

  if (!payrollEnabled) {
    return (
      <div>
        <Breadcrumb pageName="Payroll - Pay Runs" />
        <UpgradePrompt feature="Payroll" />
      </div>
    );
  }

  if (forbidden) return <PermissionDenied />;

  return (
    <div>
      <Breadcrumb pageName="Payroll - Pay Runs" />
      <div className="rounded-lg border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pay Runs</h2>
          <div className="flex items-center gap-2">
            <Link
              href="/payroll"
              className="rounded border border-stroke px-4 py-2 text-sm hover:bg-gray-50 dark:border-strokedark dark:hover:bg-boxdark-2"
            >
              Back
            </Link>
            <input
              type="month"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
              className="rounded border border-stroke px-3 py-2 dark:border-strokedark dark:bg-boxdark-2"
            />
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Pay Run"}
            </button>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-2">
            {payRuns.map((pr) => (
              <div
                key={pr.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded border border-stroke px-4 py-3 dark:border-strokedark"
              >
                <div className="flex items-center gap-4">
                  <span className="font-medium">{pr.periodMonth}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      pr.status === "paid"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : pr.status === "finalized"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {pr.status}
                  </span>
                  <Price amount={pr.totalNet} currency={pr.currency} />
                </div>
                <div className="flex gap-2">
                  {pr.status === "draft" && (
                    <button
                      onClick={() => handleFinalize(pr.id)}
                      disabled={submitting}
                      className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Finalize
                    </button>
                  )}
                  {pr.status === "finalized" && (
                    <button
                      onClick={() => handlePay(pr.id)}
                      disabled={submitting}
                      className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Pay
                    </button>
                  )}
                </div>
              </div>
            ))}
            {payRuns.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">
                No pay runs yet. Create one for a month to run payroll.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
