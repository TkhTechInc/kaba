"use client";

import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { useFeatures, invalidateFeaturesCache } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import { Price } from "@/components/ui/Price";
import { updateBusinessTier, type Tier } from "@/services/business.service";
import { createPlanCheckout } from "@/services/plans.service";
import Link from "next/link";
import { useState } from "react";

/** Monthly price per tier. Key = currency code, value = price per tier. */
const PLAN_PRICES: Record<string, Record<Tier, number | null>> = {
  NGN: { free: 0, starter: 5000, pro: 15000, enterprise: 50000 },
  GHS: { free: 0, starter: 50, pro: 150, enterprise: 500 },
  XOF: { free: 0, starter: 2500, pro: 7500, enterprise: 25000 },
  XAF: { free: 0, starter: 2500, pro: 7500, enterprise: 25000 },
  USD: { free: 0, starter: 5, pro: 15, enterprise: 50 },
  EUR: { free: 0, starter: 5, pro: 15, enterprise: 50 },
};

const TIER_ORDER: Tier[] = ["free", "starter", "pro", "enterprise"];

function tierIndex(t: Tier): number {
  return TIER_ORDER.indexOf(t);
}

export default function SettingsPage() {
  const { t } = useLocale();
  const { token, businessId } = useAuth();
  const { tier, currency, loading, refetch } = useFeatures(businessId);
  const { hasPermission } = usePermissions(businessId);
  const canChangePlan = hasPermission("business:tier");
  const [updating, setUpdating] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const TIERS: { id: Tier; name: string; features: string[] }[] = [
    {
      id: "free",
      name: t("settings.plans.tiers.free.name"),
      features: [
        t("settings.plans.tiers.free.f1"),
        t("settings.plans.tiers.free.f2"),
        t("settings.plans.tiers.free.f3"),
      ],
    },
    {
      id: "starter",
      name: t("settings.plans.tiers.starter.name"),
      features: [
        t("settings.plans.tiers.starter.f1"),
        t("settings.plans.tiers.starter.f2"),
        t("settings.plans.tiers.starter.f3"),
        t("settings.plans.tiers.starter.f4"),
      ],
    },
    {
      id: "pro",
      name: t("settings.plans.tiers.pro.name"),
      features: [
        t("settings.plans.tiers.pro.f1"),
        t("settings.plans.tiers.pro.f2"),
        t("settings.plans.tiers.pro.f3"),
        t("settings.plans.tiers.pro.f4"),
        t("settings.plans.tiers.pro.f5"),
      ],
    },
    {
      id: "enterprise",
      name: t("settings.plans.tiers.enterprise.name"),
      features: [
        t("settings.plans.tiers.enterprise.f1"),
        t("settings.plans.tiers.enterprise.f2"),
        t("settings.plans.tiers.enterprise.f3"),
      ],
    },
  ];

  const handlePlanChange = async (newTier: Tier) => {
    if (!businessId || !token || !canChangePlan) return;
    const currentIdx = tierIndex((tier ?? "free") as Tier);
    const newIdx = tierIndex(newTier);
    if (newIdx === currentIdx) return;
    setError(null);
    setUpdating(newTier);
    try {
      const isUpgrade = newIdx > currentIdx;
      const prices = currency ? (PLAN_PRICES[currency] ?? PLAN_PRICES.XOF) : PLAN_PRICES.XOF;
      const price = prices[newTier] ?? 0;
      if (isUpgrade && price > 0) {
        const checkout = await createPlanCheckout(businessId, newTier, token);
        window.location.href = checkout.payUrl;
        return;
      }
      await updateBusinessTier(businessId, newTier, token);
      invalidateFeaturesCache(businessId);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.plans.updateFailed"));
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Settings navigation">
        {[
          { label: t("settings.nav.plans"), href: "/settings" },
          { label: t("settings.nav.team"), href: "/settings/team" },
          { label: t("settings.nav.activityLog"), href: "/settings/activity" },
          { label: t("settings.nav.preferences"), href: "/settings/preferences" },
          { label: t("settings.nav.apiKeys"), href: "/settings/api-keys" },
          { label: t("settings.nav.webhooks"), href: "/settings/webhooks" },
          { label: t("settings.nav.compliance"), href: "/settings/compliance" },
        ].map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:text-white dark:hover:border-primary dark:hover:text-primary"
          >
            {label}
          </Link>
        ))}
      </nav>
      <h1 className="mb-4 text-heading-4 font-bold text-dark dark:text-white">
        {t("settings.title")}
      </h1>
      <p className="mb-8 text-dark-4 dark:text-dark-6">
        {t("settings.subtitle")}
      </p>

      <div className="mb-8 flex flex-wrap gap-4">
        <Link
          href="/settings/team"
          className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition hover:border-primary/50 hover:bg-primary/5 dark:border-gray-700 dark:bg-gray-dark dark:hover:border-primary/50 dark:hover:bg-primary/10"
        >
          <span className="font-medium text-dark dark:text-white">{t("settings.card.teamLabel")}</span>
          <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
            {t("settings.card.teamDesc")}
          </p>
        </Link>
        <Link
          href="/settings/preferences"
          className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition hover:border-primary/50 hover:bg-primary/5 dark:border-gray-700 dark:bg-gray-dark dark:hover:border-primary/50 dark:hover:bg-primary/10"
        >
          <span className="font-medium text-dark dark:text-white">{t("settings.card.preferencesLabel")}</span>
          <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
            {t("settings.card.preferencesDesc")}
          </p>
        </Link>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-dark">
        <h2 className="mb-2 text-lg font-semibold text-dark dark:text-white">
          {t("settings.plans.title")}
        </h2>
        <p className="mb-6 text-sm text-dark-4 dark:text-dark-6">
          {t("settings.plans.currentPlan")}{" "}
          <span className="font-medium capitalize text-dark dark:text-white">
            {tier ?? "—"}
          </span>
          {currency && (
            <>
              {" · "}
              {t("settings.plans.pricesIn", { currency })}
            </>
          )}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {!canChangePlan && (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {t("settings.plans.restrictedNotice")}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((plan) => {
            const current = (tier ?? "free") === plan.id;
            const currentIdx = tierIndex((tier ?? "free") as Tier);
            const planIdx = tierIndex(plan.id);
            const isHigher = planIdx > currentIdx;
            const isLower = planIdx < currentIdx;
            const isUpdating = updating === plan.id;
            const showUpgrade = canChangePlan && isHigher;
            const showDowngrade = canChangePlan && isLower;

            const prices = currency
              ? PLAN_PRICES[currency] ?? PLAN_PRICES.NGN
              : null;
            const price = prices?.[plan.id] ?? null;

            return (
              <div
                key={plan.id}
                className={`flex min-h-[280px] flex-col rounded-lg border p-4 ${
                  current
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold capitalize text-dark dark:text-white">
                    {plan.name}
                    {current && (
                      <span className="ml-2 text-xs font-normal text-primary">
                        {t("settings.plans.currentBadge")}
                      </span>
                    )}
                  </h3>
                  <span className="text-sm font-medium text-dark dark:text-white">
                    {loading || !currency ? "—" : price === null || price === 0 ? t("settings.plans.tiers.free.name") : <Price amount={price} currency={currency} suffix={t("settings.plans.perMonth")} />}
                  </span>
                </div>
                <ul className="mb-4 flex-1 space-y-1 text-sm text-dark-4 dark:text-dark-6">
                  {plan.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <div className="mt-auto pt-4">
                  {showUpgrade ? (
                    <button
                      onClick={() => handlePlanChange(plan.id)}
                      disabled={isUpdating}
                      className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isUpdating ? t("settings.plans.updating") : t("settings.plans.upgrade")}
                    </button>
                  ) : showDowngrade ? (
                    <button
                      onClick={() => handlePlanChange(plan.id)}
                      disabled={isUpdating}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-dark-6 hover:bg-gray-50 dark:border-dark-3 dark:text-dark-6 dark:hover:bg-dark-2 disabled:opacity-50"
                    >
                      {isUpdating ? t("settings.plans.updating") : t("settings.plans.downgrade")}
                    </button>
                  ) : (
                    <div className="h-10" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
