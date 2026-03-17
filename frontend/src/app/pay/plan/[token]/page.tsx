"use client";

import { Logo } from "@/components/logo";
import { MoMoLogo } from "@/components/payments/MoMoLogo";
import { Price } from "@/components/ui/Price";
import { getPlanPayData, requestPlanMoMo } from "@/services/plans.service";
import { invalidateFeaturesCache } from "@/hooks/use-features";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/contexts/locale-context";

function PayShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-8 text-dark">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-blue-200/60 blur-3xl" />
      </div>
      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col">{children}</div>
    </div>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-stroke bg-white p-6 shadow-1 sm:p-8">
      {children}
    </div>
  );
}

function KkiaPayPlanWidget({
  token,
  intentId,
  amount,
  currency,
  kkiapayPublicKey: publicKeyFromApi,
  kkiapaySandbox: sandboxFromApi,
}: {
  token: string;
  intentId?: string;
  amount: number;
  currency: string;
  kkiapayPublicKey?: string;
  kkiapaySandbox?: boolean;
}) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicKey = (publicKeyFromApi ?? process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY ?? "").trim();
  const sandbox = sandboxFromApi ?? (process.env.NEXT_PUBLIC_KKIAPAY_SANDBOX ?? "true") === "true";
  const amountWhole = ["XOF", "XAF", "GNF"].includes(currency?.toUpperCase?.() ?? "")
    ? Math.round(amount)
    : Math.round(amount * 100);
  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/pay/plan/kkiapay-return?token=${encodeURIComponent(token)}${intentId ? `&intentId=${encodeURIComponent(intentId)}` : ""}`
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
    if (!intentId) {
      setError("Payment session expired. Refresh and try again.");
      return;
    }
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
      className="block w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-110"
    >
      Pay with KkiaPay (Mobile Money / Card)
    </button>
  );
}

/** MoMo RequestToPay: enter phone, request sent to customer's MoMo app. */
function MoMoPlanRequestForm({
  token,
  onRequestSent,
  onError,
}: {
  token: string;
  onRequestSent: () => void;
  onError: (msg: string) => void;
}) {
  const { t } = useLocale();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      onError("Enter your MoMo phone number");
      return;
    }
    setLoading(true);
    onError("");
    try {
      const res = await requestPlanMoMo(token, phone.trim());
      if (res?.success) {
        onRequestSent();
      } else {
        onError(t("pay.requestFailed"));
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : t("pay.requestFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="momo-phone" className="sr-only">
        {t("pay.momoPhoneLabel")}
      </label>
      <input
        id="momo-phone"
        name="phone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+233241234567 or 0241234567"
        autoComplete="tel"
        className="w-full rounded-xl border border-stroke bg-white px-4 py-3 text-dark placeholder:text-dark-5"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-blue-500 px-4 py-3 font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-110 disabled:opacity-60"
      >
        <MoMoLogo className="h-6 w-auto" />
        {loading ? "Sending…" : "Pay with MoMo"}
      </button>
      <p className="text-center text-xs text-dark-5">
        A payment request will be sent to your phone. Approve it in your MoMo app.
      </p>
    </form>
  );
}

function PlanPayContent() {
  const params = useParams();
  const { t } = useLocale();
  const tokenParam = params?.token as string | undefined;
  const [data, setData] = useState<{
    businessId?: string;
    businessName: string;
    targetTier: string;
    amount: number;
    currency: string;
    useKkiaPayWidget: boolean;
    useMomoRequest?: boolean;
    intentId?: string;
    upgraded?: boolean;
    kkiapayPublicKey?: string;
    kkiapaySandbox?: boolean;
  } | null>(null);
  const [momoRequestSent, setMomoRequestSent] = useState(false);
  const [momoError, setMomoError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback((token: string) => {
    if (pollTimerRef.current) return;
    setPolling(true);
    pollTimerRef.current = setInterval(async () => {
      try {
        const d = await getPlanPayData(token);
        if (d) {
          setData(d);
          if (d.upgraded) {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            setPolling(false);
          }
        }
      } catch {
        // ignore
      }
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);
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
        setError(err instanceof Error ? err.message : t("pay.requestFailed"));
      })
      .finally(() => setLoading(false));
  }, [tokenParam, t]);

  if (!tokenParam?.trim()) {
    return (
      <PayShell>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center">
          <Link href="/" className="mb-10 inline-flex origin-left scale-[1.2]">
            <Logo />
          </Link>
          <GlassCard>
            <h1 className="mb-2 text-xl font-bold text-dark">
              Invalid payment link
            </h1>
            <p className="mb-6 text-sm text-dark-5">
              This payment link is invalid or missing.
            </p>
            <Link
              href="/settings"
              className="block w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-110"
            >
              Back to Settings
            </Link>
          </GlassCard>
        </div>
      </PayShell>
    );
  }

  if (loading) {
    return (
      <PayShell>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center">
          <Link href="/" className="mb-10 inline-flex origin-left scale-[1.2]">
            <Logo />
          </Link>
          <GlassCard>
            <div className="flex w-full flex-col items-center justify-center gap-4 py-6">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-dark-5">Loading…</p>
            </div>
          </GlassCard>
        </div>
      </PayShell>
    );
  }

  if (error || !data) {
    return (
      <PayShell>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center">
          <Link href="/" className="mb-10 inline-flex origin-left scale-[1.2]">
            <Logo />
          </Link>
          <GlassCard>
            <h1 className="mb-2 text-xl font-bold text-dark">
              Invalid or expired link
            </h1>
            <p className="mb-6 text-sm text-dark-5">
              {error ?? "This payment link is invalid or has expired."}
            </p>
            <Link
              href="/settings"
              className="block w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-110"
            >
              Back to Settings
            </Link>
          </GlassCard>
        </div>
      </PayShell>
    );
  }

  return (
    <PayShell>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        <Link href="/" className="mb-10 inline-flex origin-left scale-[1.2]">
          <Logo />
        </Link>
        <GlassCard>
          <div className="mb-6 border-b border-stroke pb-6">
            <p className="mb-2 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              Secure checkout
            </p>
            <h1 className="text-3xl font-bold text-dark">
              Upgrade to {data.targetTier.charAt(0).toUpperCase() + data.targetTier.slice(1)}
            </h1>
            <p className="mt-1 text-base text-dark-5">
              {data.businessName}
            </p>
          </div>
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-dark-5">Amount</p>
              <p className="text-3xl font-bold text-dark">
                <Price amount={data.amount} currency={data.currency} suffix=" / month" />
              </p>
            </div>
            {data.upgraded ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/25">
                  <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-semibold text-emerald-200">Upgrade confirmed</p>
                <p className="text-center text-sm text-emerald-100/85">
                  Your plan has been upgraded. Thank you for your payment.
                </p>
              </div>
            ) : (data.useKkiaPayWidget || data.useMomoRequest) && tokenParam ? (
              <div className="flex flex-col gap-4">
                {(data.useKkiaPayWidget && data.useMomoRequest) && (
                  <p className="text-base font-semibold text-dark">Choose payment method</p>
                )}
                <div className="grid gap-6 lg:grid-cols-2">
                  {data.useKkiaPayWidget && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-stroke bg-gray-1 p-6">
                      <p className="text-sm font-semibold uppercase tracking-wide text-dark-5">KkiaPay</p>
                      <KkiaPayPlanWidget
                        token={tokenParam}
                        intentId={data.intentId}
                        amount={data.amount}
                        currency={data.currency}
                        kkiapayPublicKey={data.kkiapayPublicKey}
                        kkiapaySandbox={data.kkiapaySandbox}
                      />
                      <p className="text-center text-sm text-dark-5">Mobile Money or Card</p>
                    </div>
                  )}
                  {data.useMomoRequest && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-stroke bg-gray-1 p-6">
                      <div className="flex items-center gap-2">
                        <MoMoLogo className="h-7 w-auto" />
                        <p className="text-sm font-semibold uppercase tracking-wide text-dark-5">MTN MoMo</p>
                      </div>
                      {momoRequestSent ? (
                        <>
                          <div className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 p-3">
                            <p className="font-medium text-emerald-200">Check your phone</p>
                            <p className="mt-1 text-sm text-emerald-100/85">Approve the request in your MoMo app.</p>
                          </div>
                          {polling && (
                            <p className="flex items-center justify-center gap-2 text-sm text-dark-5">
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              Waiting…
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <MoMoPlanRequestForm
                            token={tokenParam}
                            onRequestSent={() => {
                              setMomoRequestSent(true);
                              startPolling(tokenParam);
                            }}
                            onError={setMomoError}
                          />
                          {momoError && (
                            <p className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-2 text-xs text-amber-100">
                              {momoError}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-900">
                Payment is not available for this currency. Contact support.
              </p>
            )}
            {data.upgraded ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => { if (data.businessId) invalidateFeaturesCache(data.businessId); window.location.href = "/settings"; }}
                  className="block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Go to Settings
                </button>
                <button
                  type="button"
                  onClick={() => { if (data.businessId) invalidateFeaturesCache(data.businessId); window.location.href = "/"; }}
                  className="block w-full rounded-lg border border-stroke py-2.5 text-center text-sm font-semibold text-dark dark:text-white dark:border-dark-3"
                >
                  Dashboard
                </button>
              </div>
            ) : (
              <Link
                href="/settings"
                className="block text-center text-sm text-dark-5 hover:text-dark"
              >
                ← Back to Settings
              </Link>
            )}
          </div>
        </GlassCard>
      </div>
    </PayShell>
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
