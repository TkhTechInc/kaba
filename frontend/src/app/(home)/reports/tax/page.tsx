"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { useLocale } from "@/contexts/locale-context";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Price } from "@/components/ui/Price";
import { createTaxApi } from "@/services/tax.service";
import type { VATSummary } from "@/services/tax.service";
import { useEffect, useState } from "react";

const DEFAULT_DAYS = 30;

function getDefaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - DEFAULT_DAYS);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

const COUNTRY_OPTIONS = [
  { code: "NG", label: "Nigeria" },
  { code: "GH", label: "Ghana" },
  { code: "BJ", label: "Benin" },
];

export default function TaxReportPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const { t } = useLocale();
  const [dates, setDates] = useState(getDefaultDates);
  const [countryCode, setCountryCode] = useState("NG");
  const [vat, setVat] = useState<VATSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = createTaxApi(token);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    api
      .getVAT(businessId, dates.fromDate, dates.toDate, countryCode)
      .then((res) => setVat(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [businessId, dates.fromDate, dates.toDate, countryCode]);

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName={t("tax.pageName")} />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("tax.noBusinessSelected")}</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName={t("tax.pageName")} />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("tax")) {
    return (
      <>
        <Breadcrumb pageName={t("tax.pageName")} />
        <UpgradePrompt feature="Tax / VAT reports" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName={t("tax.pageName")} />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-body-sm font-medium text-dark dark:text-white">
            {t("tax.fromLabel")}
          </label>
          <input
            type="date"
            value={dates.fromDate}
            onChange={(e) =>
              setDates((d) => ({ ...d, fromDate: e.target.value }))
            }
            className="rounded-lg border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-body-sm font-medium text-dark dark:text-white">
            {t("tax.toLabel")}
          </label>
          <input
            type="date"
            value={dates.toDate}
            onChange={(e) =>
              setDates((d) => ({ ...d, toDate: e.target.value }))
            }
            className="rounded-lg border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-body-sm font-medium text-dark dark:text-white">
            {t("tax.countryLabel")}
          </label>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="rounded-lg border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
          >
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red/10 p-4 text-red">{error}</div>
      )}

      {loading ? (
        <div className="rounded-lg border border-stroke bg-white p-12 text-center dark:border-dark-3 dark:bg-gray-dark">
          {t("tax.loading")}
        </div>
      ) : vat ? (
        <div className="rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
            <h3 className="font-semibold text-dark dark:text-white">
              {t("tax.summaryTitle", {
                startDate: vat.period?.start ?? dates.fromDate,
                endDate: vat.period?.end ?? dates.toDate,
              })}
            </h3>
          </div>
          <div className="p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-gray-2 p-4 dark:bg-dark-2">
              <div>
                <p className="text-sm text-dark-6">{t("tax.totalVAT")}</p>
                <p className="text-lg font-semibold text-dark dark:text-white">
                  <Price amount={vat.totalVAT} currency={vat.currency} />
                </p>
              </div>
              <div>
                <p className="text-sm text-dark-6">{t("tax.totalSales")}</p>
                <p className="text-lg font-semibold text-green-600">
                  <Price amount={vat.totalSales} currency={vat.currency} />
                </p>
              </div>
              <div>
                <p className="text-sm text-dark-6">{t("tax.totalPurchases")}</p>
                <p className="text-lg font-semibold text-red">
                  <Price amount={vat.totalPurchases} currency={vat.currency} />
                </p>
              </div>
            </div>

            {vat.breakdown && vat.breakdown.length > 0 && (
              <ResponsiveDataList<{ rate: number; base: number; amount: number }>
                items={vat.breakdown}
                keyExtractor={(row) => `${row.rate}-${row.base}-${row.amount}`}
                emptyMessage={t("tax.noBreakdown")}
                columns={[
                  { key: "rate", label: t("tax.rate"), render: (r) => `${r.rate}%`, prominent: true },
                  { key: "base", label: t("tax.base"), render: (r) => <Price amount={r.base} currency={vat.currency} />, align: "right" },
                  { key: "amount", label: t("tax.vatAmount"), render: (r) => <Price amount={r.amount} currency={vat.currency} />, align: "right" },
                ]}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("tax.noData")}</p>
        </div>
      )}
    </>
  );
}
