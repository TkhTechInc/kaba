"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { useLocale } from "@/contexts/locale-context";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Price } from "@/components/ui/Price";
import { createReconciliationApi } from "@/services/reconciliation.service";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { ApiError } from "@/lib/api-client";
import { useState } from "react";
import Link from "next/link";

export default function ReconciliationPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const { t } = useLocale();
  const [smsText, setSmsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
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
        setResult(r);
        setSmsText("");
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : "Failed to reconcile");
      })
      .finally(() => setLoading(false));
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName={t("mobileMoney.pageName")} />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("mobileMoney.noBusinessSelected")}</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName={t("mobileMoney.pageName")} />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("mobile_money_recon")) {
    return (
      <>
        <Breadcrumb pageName={t("mobileMoney.pageName")} />
        <UpgradePrompt feature="Mobile money reconciliation" />
      </>
    );
  }

  if (forbidden) {
    return (
      <>
        <Breadcrumb pageName={t("mobileMoney.pageName")} />
        <PermissionDenied resource="Mobile Money Reconciliation" backHref="/" backLabel="Go to Dashboard" />
      </>
    );
  }

  const limit = features.limits?.mobile_money_recon;

  return (
    <>
      <Breadcrumb pageName={t("mobileMoney.pageName")} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">
            {t("mobileMoney.inputTitle")}
          </h3>
          <p className="mb-4 text-sm text-dark-6">
            {t("mobileMoney.inputSubtitle")}
          </p>
          {limit != null && (
            <p className="mb-4 text-sm text-dark-6">
              {t("mobileMoney.limitNotice", { limit: String(limit) })}
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
                {t("mobileMoney.smsLabel")}
              </label>
              <textarea
                id="sms-text"
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                placeholder={t("mobileMoney.smsPlaceholder")}
                rows={5}
                className="w-full rounded-lg border border-stroke px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !smsText.trim()}
              className="w-full rounded-lg bg-primary py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? t("mobileMoney.processing") : t("mobileMoney.submit")}
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">{t("mobileMoney.resultTitle")}</h3>
          {!result ? (
            <p className="text-dark-6">
              {t("mobileMoney.resultEmpty")}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-green/10 p-4 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                <p className="font-medium">{t("mobileMoney.entryCreated")}</p>
                {result.matchedInvoice && (
                  <p className="mt-2 text-sm">
                    {t("mobileMoney.invoiceAutoPaid", { number: result.matchedInvoice.number })}
                  </p>
                )}
                {result.matchedInvoices && result.matchedInvoices.length > 0 && (
                  <div className="mt-2 text-sm">
                    <p className="font-medium">{t("mobileMoney.multipleInvoices")}</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {result.matchedInvoices.map((inv) => (
                        <li key={inv.id}>
                          {inv.id ? (
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="text-primary hover:underline"
                            >
                              Invoice #{inv.number}
                            </Link>
                          ) : (
                            <span>Invoice #{inv.number}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-gray-2 p-4 dark:bg-dark-2">
                <h4 className="mb-2 text-sm font-medium text-dark dark:text-white">
                  {t("mobileMoney.parsedTitle")}
                </h4>
                <dl className="space-y-1 text-sm">
                  <div>
                    <dt className="inline font-medium text-dark-6">{t("mobileMoney.parsedType")} </dt>
                    <dd className="inline">
                      {result.parsed.type === "credit" ? t("mobileMoney.parsedReceived") : t("mobileMoney.parsedSent")}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-dark-6">{t("mobileMoney.parsedAmount")} </dt>
                    <dd className="inline">
                      <Price amount={result.parsed.amount} currency={result.parsed.currency} />
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-dark-6">{t("mobileMoney.parsedDate")} </dt>
                    <dd className="inline">{result.parsed.date}</dd>
                  </div>
                  {result.parsed.reference && (
                    <div>
                      <dt className="inline font-medium text-dark-6">{t("mobileMoney.parsedRef")} </dt>
                      <dd className="inline">{result.parsed.reference}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="rounded-lg bg-gray-2 p-4 dark:bg-dark-2">
                <h4 className="mb-2 text-sm font-medium text-dark dark:text-white">
                  {t("mobileMoney.ledgerEntryTitle")}
                </h4>
                <p className="text-sm text-dark-6">
                  {result.entry.type === "sale" ? t("mobileMoney.entryType.sale") : t("mobileMoney.entryType.expense")} •{" "}
                  <Price amount={result.entry.amount} currency={result.entry.currency} /> •{" "}
                  {result.entry.date}
                </p>
              </div>
              <Link
                href="/ledger"
                className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                {t("mobileMoney.viewInLedger")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
