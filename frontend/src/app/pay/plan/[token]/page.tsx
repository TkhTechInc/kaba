"use client";

import { Logo } from "@/components/logo";
import { Price } from "@/components/ui/Price";
import { getPlanPayData, confirmPlanKkiaPay } from "@/services/plans.service";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

function KkiaPayPlanWidget({
  token,
  amount,
  currency,
}: {
  token: string;
  amount: number;
  currency: string;
}) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicKey = process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY ?? "";
  const sandbox = (process.env.NEXT_PUBLIC_KKIAPAY_SANDBOX ?? "true") === "true";
  const amountWhole = ["XOF", "XAF", "GNF"].includes(currency?.toUpperCase?.() ?? "")
    ? Math.round(amount)
    : Math.round(amount * 100);
  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/pay/plan/kkiapay-return?token=${encodeURIComponent(token)}`
      : "";

  useEffect(() => {
    if (!publicKey) {
      setError("KkiaPay not configured");
      return;
    }
    if (document.querySelector('script[src="https://cdn.kkiapay.me/k.js"]')) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.kkiapay.me/k.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setError("Could not load KkiaPay");
    document.body.appendChild(script);
  }, [publicKey]);

  const openWidget = () => {
    const win = typeof window !== "undefined"
      ? (window as Window & { openKkiapayWidget?: (opts: Record<string, unknown>) => void })
      : null;
    if (!win?.openKkiapayWidget) {
      setError("KkiaPay not ready");
      return;
    }
    setError(null);
    win.openKkiapayWidget({
      amount: String(amountWhole),
      key: publicKey,
      callback: callbackUrl,
      sandbox,
      position: "center",
      theme: "#0095ff",
    });
  };

  if (error) {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        {error}
      </p>
    );
  }
  if (!scriptLoaded) {
    return (
      <div className="flex justify-center gap-2 py-3 text-sm text-dark-4 dark:text-dark-6">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading payment…
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={openWidget}
      className="block w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-white hover:bg-primary/90"
    >
      Pay with KkiaPay (Mobile Money / Card)
    </button>
  );
}

function PlanPayContent() {
  const params = useParams();
  const tokenParam = params?.token as string | undefined;
  const [data, setData] = useState<{
    businessName: string;
    targetTier: string;
    amount: number;
    currency: string;
    useKkiaPayWidget: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenParam?.trim()) {
      setLoading(false);
      setError("Invalid payment link");
      return;
    }
    getPlanPayData(tokenParam)
      .then((d) => {
        if (d) {
          setData(d);
          setError(null);
        } else {
          setError("Invalid or expired payment link");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [tokenParam]);

  if (!tokenParam?.trim()) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center">
          <Link href="/" className="mb-8 inline-flex">
            <Logo />
          </Link>
          <div className="w-full rounded-[10px] bg-white p-8 shadow-1 dark:bg-gray-dark dark:shadow-card">
            <h1 className="mb-2 text-xl font-bold text-dark dark:text-white">
              Invalid payment link
            </h1>
            <p className="mb-6 text-body-sm text-dark-4 dark:text-dark-6">
              This payment link is invalid or missing.
            </p>
            <Link
              href="/settings"
              className="block w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-white hover:bg-primary/90"
            >
              Back to Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center">
          <Link href="/" className="mb-8 inline-flex">
            <Logo />
          </Link>
          <div className="flex w-full flex-col items-center justify-center gap-4 rounded-[10px] bg-white p-12 shadow-1 dark:bg-gray-dark dark:shadow-card">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-dark-4 dark:text-dark-6">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center">
          <Link href="/" className="mb-8 inline-flex">
            <Logo />
          </Link>
          <div className="w-full rounded-[10px] bg-white p-8 shadow-1 dark:bg-gray-dark dark:shadow-card">
            <h1 className="mb-2 text-xl font-bold text-dark dark:text-white">
              Invalid or expired link
            </h1>
            <p className="mb-6 text-body-sm text-dark-4 dark:text-dark-6">
              {error ?? "This payment link is invalid or has expired."}
            </p>
            <Link
              href="/settings"
              className="block w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-white hover:bg-primary/90"
            >
              Back to Settings
            </Link>
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
        <div className="flex flex-1 flex-col rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
          <div className="border-b border-stroke p-6 dark:border-dark-3 sm:p-8">
            <h1 className="text-heading-4 font-bold text-dark dark:text-white">
              Upgrade to {data.targetTier.charAt(0).toUpperCase() + data.targetTier.slice(1)}
            </h1>
            <p className="mt-1 text-body-sm text-dark-4 dark:text-dark-6">
              {data.businessName}
            </p>
          </div>
          <div className="space-y-6 p-6 sm:p-8">
            <div>
              <p className="text-sm font-medium text-dark-6">Amount</p>
              <p className="text-lg font-semibold text-dark dark:text-white">
                <Price amount={data.amount} currency={data.currency} suffix=" / month" />
              </p>
            </div>
            {data.useKkiaPayWidget ? (
              <KkiaPayPlanWidget
                token={tokenParam}
                amount={data.amount}
                currency={data.currency}
              />
            ) : (
              <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                Payment is not available for this currency. Contact support.
              </p>
            )}
            <Link
              href="/settings"
              className="block text-center text-sm text-dark-4 hover:text-dark dark:text-dark-6 dark:hover:text-dark-4"
            >
              ← Back to Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlanPayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-2 dark:bg-[#020d1a]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-dark-4 dark:text-dark-6">Loading…</p>
        </div>
      }
    >
      <PlanPayContent />
    </Suspense>
  );
}
