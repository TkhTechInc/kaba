"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { compactFormat, formatPriceWithCurrency } from "@/lib/format-number";
import { getDashboardSummary } from "@/services/dashboard.service";
import { useAuth } from "@/contexts/auth-context";
import { useDashboardRefresh } from "@/app/(home)/_components/dashboard-refresh-provider";
import { useFeatures } from "@/hooks/use-features";
import { OverviewCard } from "./card";
import * as icons from "./icons";
import { useLocale } from "@/contexts/locale-context";

export function OverviewCardsGroupClient() {
  const { token, businessId } = useAuth();
  const { refreshTrigger } = useDashboardRefresh();
  const features = useFeatures(businessId);
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardSummary>>>(null);

  useEffect(() => {
    if (!businessId || !token) {
      setLoading(false);
      setData(null);
      return;
    }
    let cancelled = false;
    getDashboardSummary(businessId, token)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, token, refreshTrigger]);

  if (!businessId) {
    return (
      <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
        <p className="text-dark-6">{t("dashboard.cards.noBusinessSelected")}</p>
      </div>
    );
  }

  if (loading || features.loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4 2xl:gap-7.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-[10px] bg-white shadow-1 dark:bg-gray-dark"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
        <p className="text-dark-6">{t("dashboard.cards.loadError")}</p>
      </div>
    );
  }

  const cards = [
    {
      label: t("dashboard.cards.cashBalance"),
      show: features.isEnabled("ledger"),
      data: {
        value: data.balance != null ? formatPriceWithCurrency(data.balance, data.currency) : "—",
        growthRate: undefined,
      },
      href: "/ledger",
      statusColor: data.balance != null && data.balance < 0 ? "danger" : "ok",
      Icon: icons.Profit,
    },
    {
      label: t("dashboard.cards.invoices"),
      show: features.isEnabled("invoicing"),
      data: {
        value: compactFormat(data.invoicesCount),
        growthRate: undefined,
      },
      href: "/invoices",
      statusColor: "ok",
      Icon: icons.Product,
    },
    {
      label: t("dashboard.cards.customers"),
      show: features.isEnabled("invoicing"),
      data: {
        value: compactFormat(data.customersCount),
        growthRate: undefined,
      },
      href: "/customers",
      statusColor: "ok",
      Icon: icons.Users,
    },
    {
      label: t("dashboard.cards.ledgerEntries"),
      show: features.isEnabled("ledger"),
      data: {
        value: compactFormat(data.ledgerEntriesCount),
        growthRate: undefined,
      },
      href: "/ledger",
      statusColor: "ok",
      Icon: icons.Views,
    },
  ].filter((c) => c.show);

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
        <p className="text-dark-6">{t("dashboard.cards.noFeaturesEnabled")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4 2xl:gap-7.5">
        {cards.map(({ label, data: cardData, Icon, href }) => (
          <Link key={label} href={href} className="block transition-transform hover:-translate-y-0.5">
            <OverviewCard label={label} data={cardData} Icon={Icon} />
          </Link>
        ))}
      </div>
      {data.balance != null && data.balance < 0 && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-3 rounded-lg border border-red/30 bg-red/5 px-5 py-3 text-sm text-red dark:border-red/20 dark:bg-red/10"
        >
          <span aria-hidden="true" className="text-base">⚠</span>
          <span>{t("dashboard.cards.negativeBalanceAlert")}</span>
          <a href="/ledger" className="ml-auto font-medium underline hover:no-underline">{t("dashboard.cards.viewLedger")}</a>
        </div>
      )}
    </>
  );
}
