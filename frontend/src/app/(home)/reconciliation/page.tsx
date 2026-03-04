"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { standardFormat } from "@/lib/format-number";
import { createReconciliationApi } from "@/services/reconciliation.service";
import { useState } from "react";
import Link from "next/link";

export default function ReconciliationPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const [smsText, setSmsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<import("@/services/reconciliation.service").MobileMoneyReconResult | null>(null);

  const api = createReconciliationApi(token);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !smsText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    api
      .reconcileMobileMoney(businessId, smsText.trim())
      .then((r) => {
        setResult(r.data);
        setSmsText("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="Mobile Money" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to reconcile mobile money.</p>
        </div>
      </>
    );
  }

  if (!features.isEnabled("mobile_money_recon")) {
    return (
      <>
        <Breadcrumb pageName="Mobile Money" />
        <UpgradePrompt feature="Mobile money reconciliation" />
      </>
    );
  }

  const limit = features.limits?.mobile_money_recon;

  return (
    <>
      <Breadcrumb pageName="Mobile Money" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">
            Paste MTN MoMo or Moov SMS
          </h3>
          <p className="mb-4 text-sm text-dark-6">
            Paste your mobile money transaction SMS here. We&apos;ll read the amount, date, and type
            (credit/debit) and create a ledger entry for you. No more manual typing.
          </p>
          {limit != null && (
            <p className="mb-4 text-sm text-dark-6">
              {limit} reconciliations per month on your plan.
            </p>
          )}
          {error && (
            <div className="mb-4 rounded bg-red/10 p-3 text-sm text-red">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="sms-text"
                className="mb-2 block text-body-sm font-medium text-dark dark:text-white"
              >
                SMS text
              </label>
              <textarea
                id="sms-text"
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                placeholder="e.g. You have received 50,000 XAF from John. Ref: ABC123. 04/03/2025"
                rows={5}
                className="w-full rounded-lg border border-stroke px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !smsText.trim()}
              className="w-full rounded-lg bg-primary py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Processing…" : "Create ledger entry"}
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">Result</h3>
          {!result ? (
            <p className="text-dark-6">
              Paste an SMS and click &quot;Create ledger entry&quot; to see the result here.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-green/10 p-4 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                <p className="font-medium">Entry created successfully</p>
              </div>
              <div className="rounded-lg bg-gray-2 p-4 dark:bg-dark-2">
                <h4 className="mb-2 text-sm font-medium text-dark dark:text-white">
                  Parsed
                </h4>
                <dl className="space-y-1 text-sm">
                  <div>
                    <dt className="inline font-medium text-dark-6">Type: </dt>
                    <dd className="inline">
                      {result.parsed.type === "credit" ? "Received" : "Sent"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-dark-6">Amount: </dt>
                    <dd className="inline">
                      {result.parsed.currency} {standardFormat(result.parsed.amount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-dark-6">Date: </dt>
                    <dd className="inline">{result.parsed.date}</dd>
                  </div>
                  {result.parsed.reference && (
                    <div>
                      <dt className="inline font-medium text-dark-6">Ref: </dt>
                      <dd className="inline">{result.parsed.reference}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="rounded-lg bg-gray-2 p-4 dark:bg-dark-2">
                <h4 className="mb-2 text-sm font-medium text-dark dark:text-white">
                  Ledger entry
                </h4>
                <p className="text-sm text-dark-6">
                  {result.entry.type === "sale" ? "Sale" : "Expense"} •{" "}
                  {result.entry.currency} {standardFormat(result.entry.amount)} •{" "}
                  {result.entry.date}
                </p>
              </div>
              <Link
                href="/ledger"
                className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                View in Ledger →
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
