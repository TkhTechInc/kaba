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

const CHECK_ICON = (
  <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

export default function PlansPage() {
  const { t } = useLocale();
  const { token, businessId } = useAuth();
  const { tier, currency, loading, refetch } = useFeatures(businessId);
  const { hasPermission } = usePermissions(businessId);
  const canChangePlan = hasPermission("business:tier");
  const [updating, setUpdating] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const TIERS: { id: Tier; name: string; highlight?: boolean; features: string[] }[] = [
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
      highlight: true,
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
    setSuccess(null);
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
      setSuccess(`Plan updated to ${newTier}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.plans.updateFailed"));
    } finally {
      setUpdating(null);
    }
  };

  const currentTier = (tier ?? "free") as Tier;
  const currentIdx = tierIndex(currentTier);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
        <Link href="/settings" className="hover:text-primary">
          {t("settings.nav.plans")}
        </Link>
        <span>/</span>
        <span className="text-dark dark:text-white">Plans</span>
      </div>

      <h1 className="mb-1 text-heading-4 font-bold text-dark dark:text-white">
        {t("settings.plans.title")}
      </h1>
      <p className="mb-2 text-sm text-dark-4 dark:text-dark-6">
        {t("settings.plans.currentPlan")}{" "}
        <span className="font-semibold capitalize text-dark dark:text-white">
          {loading ? "…" : currentTier}
        </span>
        {currency && (
          <span className="ml-1 text-dark-4 dark:text-dark-6">
            · {t("settings.plans.pricesIn", { currency })}
          </span>
        )}
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
          {success}
        </div>
      )}

      {!canChangePlan && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {t("settings.plans.restrictedNotice")}
        </div>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((plan) => {
          const isCurrent = currentTier === plan.id;
          const planIdx = tierIndex(plan.id);
          const isHigher = planIdx > currentIdx;
          const isLower = planIdx < currentIdx;
          const isUpdating = updating === plan.id;
          const prices = currency ? (PLAN_PRICES[currency] ?? PLAN_PRICES.NGN) : null;
          const price = prices?.[plan.id] ?? null;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-xl border p-5 shadow-sm transition ${
                isCurrent
                  ? "border-primary ring-1 ring-primary bg-primary/5 dark:bg-primary/10"
                  : plan.highlight
                    ? "border-primary/40 dark:border-primary/30 bg-white dark:bg-gray-dark"
                    : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-dark"
              }`}
            >
              {plan.highlight && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}

              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white">
                  {t("settings.plans.currentBadge")}
                </span>
              )}

              <h2 className="mb-1 text-base font-bold capitalize text-dark dark:text-white">
                {plan.name}
              </h2>

              <p className="mb-4 text-2xl font-bold text-dark dark:text-white">
                {loading || !currency
                  ? "—"
                  : price === 0
                    ? t("settings.plans.tiers.free.name")
                    : price !== null
                      ? <Price amount={price} currency={currency} suffix={t("settings.plans.perMonth")} />
                      : "—"}
              </p>

              <ul className="mb-6 flex-1 space-y-2 text-sm text-dark-4 dark:text-dark-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    {CHECK_ICON}
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                {isCurrent ? (
                  <div className="rounded-lg border border-primary px-4 py-2 text-center text-sm font-medium text-primary">
                    {t("settings.plans.currentBadge")}
                  </div>
                ) : canChangePlan && isHigher ? (
                  <button
                    onClick={() => handlePlanChange(plan.id)}
                    disabled={isUpdating}
                    className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isUpdating ? t("settings.plans.updating") : t("settings.plans.upgrade")}
                  </button>
                ) : canChangePlan && isLower ? (
                  <button
                    onClick={() => handlePlanChange(plan.id)}
                    disabled={isUpdating}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-dark-6 hover:bg-gray-50 dark:border-dark-3 dark:hover:bg-dark-2 disabled:opacity-50"
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

      <p className="mt-8 text-center text-sm text-dark-4 dark:text-dark-6">
        Need a custom plan?{" "}
        <a href="mailto:support@kabasika.com" className="text-primary underline">
          Contact us
        </a>
      </p>
    </div>
  );
}
