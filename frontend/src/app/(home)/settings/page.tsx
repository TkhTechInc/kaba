"use client";

import { useAuth } from "@/contexts/auth-context";
import { useFeatures, invalidateFeaturesCache } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import {
  formatPriceWithCurrency,
  getCurrencySymbol,
} from "@/lib/format-number";
import { updateBusinessTier, type Tier } from "@/services/business.service";
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

function formatPrice(amount: number | null, currency: string): string {
  if (amount === null || amount === 0) return "Free";
  return formatPriceWithCurrency(amount, currency, "/month");
}

const TIERS: { id: Tier; name: string; features: string[] }[] = [
  {
    id: "free",
    name: "Free",
    features: [
      "Track your sales and expenses",
      "See simple reports",
      "Good for getting started",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    features: [
      "Send invoices and get paid online",
      "Ask the AI assistant questions (10/month)",
      "Tax support for your business",
      "Track more transactions",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    features: [
      "Save receipts on your phone",
      "Send receipts by SMS to customers",
      "Ask the AI in your voice (100 questions/month)",
      "Help with loan applications",
      "Print professional reports",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    features: [
      "Everything in Pro",
      "For bigger businesses",
      "Priority support when you need help",
    ],
  },
];

const TIER_ORDER: Tier[] = ["free", "starter", "pro", "enterprise"];

function tierIndex(t: Tier): number {
  return TIER_ORDER.indexOf(t);
}

export default function SettingsPage() {
  const { token, businessId } = useAuth();
  const { tier, currency, loading, refetch } = useFeatures(businessId);
  const { hasPermission } = usePermissions(businessId);
  const canUpgrade = hasPermission("business:tier");
  const [updating, setUpdating] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (newTier: Tier) => {
    if (!businessId || !token || !canUpgrade) return;
    if (tierIndex(newTier) <= tierIndex((tier ?? "free") as Tier)) {
      setError("Select a higher plan to upgrade.");
      return;
    }
    setError(null);
    setUpdating(newTier);
    try {
      await updateBusinessTier(businessId, newTier, token);
      invalidateFeaturesCache(businessId);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update plan");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-heading-4 font-bold text-dark dark:text-white">
        Settings
      </h1>
      <p className="mb-8 text-dark-4 dark:text-dark-6">
        Configure your business settings.
      </p>

      <div className="mb-8 flex flex-wrap gap-4">
        <Link
          href="/settings/team"
          className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition hover:border-primary/50 hover:bg-primary/5 dark:border-gray-700 dark:bg-gray-dark dark:hover:border-primary/50 dark:hover:bg-primary/10"
        >
          <span className="font-medium text-dark dark:text-white">Team</span>
          <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
            Manage who has access to this business
          </p>
        </Link>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-dark">
        <h2 className="mb-2 text-lg font-semibold text-dark dark:text-white">
          Plans
        </h2>
        <p className="mb-6 text-sm text-dark-4 dark:text-dark-6">
          Your current plan:{" "}
          <span className="font-medium capitalize text-dark dark:text-white">
            {tier ?? "—"}
          </span>
          {currency && (
            <>
              {" · "}
              Prices in {currency}
            </>
          )}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {!canUpgrade && (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Only business owners can change the plan. Contact your admin to
            upgrade.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((plan) => {
            const current = (tier ?? "free") === plan.id;
            const isHigher = tierIndex(plan.id) > tierIndex((tier ?? "free") as Tier);
            const isUpdating = updating === plan.id;
            const showButton = canUpgrade && isHigher;

            const prices = currency
              ? PLAN_PRICES[currency] ?? PLAN_PRICES.NGN
              : null;
            const price = prices?.[plan.id] ?? null;
            const priceStr =
              loading || !currency ? "—" : formatPrice(price, currency);

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
                        (current)
                      </span>
                    )}
                  </h3>
                  <span className="text-sm font-medium text-dark dark:text-white">
                    {priceStr}
                  </span>
                </div>
                <ul className="mb-4 flex-1 space-y-1 text-sm text-dark-4 dark:text-dark-6">
                  {plan.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <div className="mt-auto pt-4">
                  {showButton ? (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={isUpdating}
                      className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {loading ? "Upgrading…" : "Upgrade"}
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
