"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { confirmPlanKkiaPay } from "@/services/plans.service";
import { invalidateFeaturesCache } from "@/hooks/use-features";
import { useLocale } from "@/contexts/locale-context";
import type { Tier } from "@/hooks/use-features";

const TIER_FEATURE_KEYS: Record<Tier, string[]> = {
  free: ["f1", "f2", "f3"],
  starter: ["f1", "f2", "f3", "f4"],
  pro: ["f1", "f2", "f3", "f4", "f5"],
  enterprise: ["f1", "f2", "f3"],
};

function PlanKkiaPayReturnContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const transactionId =
    searchParams.get("transaction_id") ?? searchParams.get("transactionId");
  const intentId = searchParams.get("intentId");
  const redirectStatus =
    searchParams.get("transaction_status") ??
    searchParams.get("status") ??
    searchParams.get("event");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("");
  const [targetTier, setTargetTier] = useState<Tier | null>(null);

  useEffect(() => {
    if (!token || !transactionId || !intentId) {
      setStatus("error");
      setMessage("Missing payment details. Return to Settings and try again.");
      return;
    }
    confirmPlanKkiaPay(token, transactionId, intentId, redirectStatus ?? undefined)
      .then((result) => {
        if (result.success) {
          if (result.businessId) invalidateFeaturesCache(result.businessId);
          setTargetTier((result.targetTier as Tier) ?? null);
          setStatus("success");
        } else {
          setStatus("error");
          setMessage("Payment confirmation failed.");
        }
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Could not confirm payment.");
      });
  }, [token, transactionId, intentId, redirectStatus]);

  const handleGoToApp = (path: string) => {
    window.location.href = path;
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center">
          <Link href="/" className="mb-8 inline-flex">
            <Logo />
          </Link>
          <div className="flex flex-col items-center gap-4 rounded-[10px] bg-white p-8 shadow-1 dark:bg-gray-dark dark:shadow-card">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-dark dark:text-white">Confirming your payment…</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <Link href="/" className="mb-8 inline-flex">
            <Logo />
          </Link>
          <div className="flex flex-1 flex-col items-center justify-center rounded-[10px] bg-white p-8 shadow-1 dark:bg-gray-dark dark:shadow-card">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-dark dark:text-white">
              {t("pay.plan.upgradeSuccess.title")}
            </h1>
            <p className="mt-1 text-center text-sm text-dark-4 dark:text-dark-6">
              {t("pay.plan.upgradeSuccess.subtitle")}
            </p>
            {targetTier && targetTier !== "free" && (
              <div className="mt-4 w-full rounded-lg border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
                <p className="mb-2 text-sm font-medium text-dark dark:text-white">
                  {t("pay.plan.upgradeSuccess.newFeatures")}
                </p>
                <ul className="space-y-1 text-sm text-dark-4 dark:text-dark-6">
                  {TIER_FEATURE_KEYS[targetTier].map((key) => (
                    <li key={key}>• {t(`settings.plans.tiers.${targetTier}.${key}`)}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 flex w-full flex-col gap-3">
              <button
                type="button"
                onClick={() => handleGoToApp("/settings")}
                className="block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-white hover:bg-primary/90"
              >
                {t("pay.plan.upgradeSuccess.goToSettings")}
              </button>
              <button
                type="button"
                onClick={() => handleGoToApp("/")}
                className="block w-full rounded-lg border border-stroke py-2.5 text-center text-sm font-semibold text-dark dark:text-white dark:border-dark-3"
              >
                {t("pay.plan.upgradeSuccess.goToDashboard")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <Link href="/" className="mb-8 inline-flex">
          <Logo />
        </Link>
        <div className="flex flex-1 flex-col items-center justify-center rounded-[10px] border border-amber-200 bg-amber-50 p-8 dark:border-amber-900/40 dark:bg-amber-900/20">
          <h1 className="text-xl font-semibold text-amber-900 dark:text-amber-200">
            Payment could not be confirmed
          </h1>
          <p className="mt-2 text-center text-sm text-amber-800 dark:text-amber-300">
            {message}
          </p>
          <div className="mt-6 flex w-full flex-col gap-3">
            <Link
              href="/settings"
              className="block w-full rounded-lg border border-amber-300 py-2.5 text-center text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
            >
              Back to Settings
            </Link>
            <Link
              href="/"
              className="block w-full rounded-lg border border-stroke py-2.5 text-center text-sm font-semibold text-dark dark:text-white dark:border-dark-3"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlanKkiaPayReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-2 dark:bg-[#020d1a]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-dark-4 dark:text-dark-6">Loading…</p>
        </div>
      }
    >
      <PlanKkiaPayReturnContent />
    </Suspense>
  );
}
