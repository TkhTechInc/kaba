"use client";

import { Logo } from "@/components/logo";
import { MoMoLogo } from "@/components/payments/MoMoLogo";
import { Price } from "@/components/ui/Price";
import {
  getStorefrontPayData,
  requestStorefrontMoMo,
} from "@/services/storefront.service";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

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

function KkiaPayStorefrontWidget({
  token,
  intentId,
  amount,
  currency,
}: {
  token: string;
  intentId?: string;
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
      ? `${window.location.origin}/pay/storefront/kkiapay-return?token=${encodeURIComponent(token)}${intentId ? `&intentId=${encodeURIComponent(intentId)}` : ""}`
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
    const win =
      typeof window !== "undefined"
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

function MoMoStorefrontRequestForm({
  token,
  onRequestSent,
  onError,
}: {
  token: string;
  onRequestSent: () => void;
  onError: (msg: string) => void;
}) {
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
      const res = await requestStorefrontMoMo(token, phone.trim());
      if (res?.success) {
        onRequestSent();
      } else {
        onError("Request failed. Please try again.");
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+233241234567 or 0241234567"
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

function StorefrontPayContent() {
  const params = useParams();
  const tokenParam = params?.token as string | undefined;
  const [data, setData] = useState<{
    businessName: string;
    amount: number;
    currency: string;
    useKkiaPayWidget: boolean;
    useMomoRequest?: boolean;
    intentId?: string;
  } | null>(null);
  const [momoRequestSent, setMomoRequestSent] = useState(false);
  const [momoError, setMomoError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenParam?.trim()) {
      setLoading(false);
      setError("Invalid payment link");
      return;
    }
    getStorefrontPayData(tokenParam)
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
              href="/"
              className="block w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-110"
            >
              Back to Home
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
              href="/"
              className="block w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-110"
            >
              Back to Home
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
              Pay {data.businessName}
            </h1>
          </div>
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-dark-5">Amount</p>
              <p className="text-3xl font-bold text-dark">
                <Price amount={data.amount} currency={data.currency} />
              </p>
            </div>
            {(data.useKkiaPayWidget || data.useMomoRequest) && tokenParam ? (
              <div className="flex flex-col gap-4">
                {data.useKkiaPayWidget && data.useMomoRequest && (
                  <p className="text-base font-semibold text-dark">
                    Choose payment method
                  </p>
                )}
                <div className="grid gap-6 lg:grid-cols-2">
                  {data.useKkiaPayWidget && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-stroke bg-gray-1 p-6">
                      <p className="text-sm font-semibold uppercase tracking-wide text-dark-5">
                        KkiaPay
                      </p>
                      <KkiaPayStorefrontWidget
                        token={tokenParam}
                        intentId={data.intentId}
                        amount={data.amount}
                        currency={data.currency}
                      />
                      <p className="text-center text-sm text-dark-5">
                        Mobile Money or Card
                      </p>
                    </div>
                  )}
                  {data.useMomoRequest && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-stroke bg-gray-1 p-6">
                      <div className="flex items-center gap-2">
                        <MoMoLogo className="h-7 w-auto" />
                        <p className="text-sm font-semibold uppercase tracking-wide text-dark-5">
                          MTN MoMo
                        </p>
                      </div>
                      {momoRequestSent ? (
                        <>
                          <div className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 p-3">
                            <p className="font-medium text-emerald-200">
                              Check your phone
                            </p>
                            <p className="mt-1 text-sm text-emerald-100/85">
                              Approve the request in your MoMo app.
                            </p>
                          </div>
                          <p className="flex items-center justify-center gap-2 text-sm text-dark-5">
                            Approve the request in your MoMo app to complete payment.
                          </p>
                        </>
                      ) : (
                        <>
                          <MoMoStorefrontRequestForm
                            token={tokenParam}
                            onRequestSent={() => setMomoRequestSent(true)}
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
                Payment is not available for this currency. Contact the business.
              </p>
            )}
            <Link
              href="/"
              className="block text-center text-sm text-dark-5 hover:text-dark"
            >
              ← Back to Home
            </Link>
          </div>
        </GlassCard>
      </div>
    </PayShell>
  );
}

export default function StorefrontPayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-2 dark:bg-[#020d1a]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-dark-4 dark:text-dark-6">Loading…</p>
        </div>
      }
    >
      <StorefrontPayContent />
    </Suspense>
  );
}
