"use client";

import { Logo } from "@/components/logo";
import { getCurrencyForCountry } from "@/lib/country-currency";
import { apiGet, apiPost } from "@/lib/api-client";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useLocale } from "@/contexts/locale-context";

interface StorefrontData {
  name?: string;
  description?: string;
  logoUrl?: string;
  currency?: string;
  countryCode?: string;
  address?: string;
  phone?: string;
  taxId?: string;
}

interface StorefrontResponse {
  success: boolean;
  data: StorefrontData;
}

interface PayResponse {
  success: boolean;
  data: {
    paymentUrl?: string;
    payUrl?: string;
    intentId?: string;
    token?: string;
    useKkiaPayWidget?: boolean;
    useMomoRequest?: boolean;
    amount?: number;
    currency?: string;
  };
}

function PayFooter() {
  return (
    <footer className="mt-8 border-t border-stroke pt-6 dark:border-dark-3">
      <p className="text-center text-sm text-dark-6">
        Powered by{" "}
        <Link href="/" className="font-medium text-primary hover:underline">
          Kaba
        </Link>
        {" — "}
        Create invoices for your business.{" "}
        <Link
          href="/auth/sign-up"
          className="font-medium text-primary hover:underline"
        >
          Sign up
        </Link>
      </p>
    </footer>
  );
}

function StorefrontContent() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLocale();
  const slug = params?.slug as string;

  const [business, setBusiness] = useState<StorefrontData | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    apiGet<StorefrontResponse>(
      `/api/v1/storefront/${encodeURIComponent(slug)}`,
      { skip401Redirect: true }
    )
      .then((res) => {
        if (res?.success && res.data) {
          setBusiness(res.data);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingBusiness(false));
  }, [slug]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setSubmitError("Please enter a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiPost<PayResponse>(
        `/api/v1/storefront/${encodeURIComponent(slug)}/pay`,
        {
          amount: parsedAmount,
          currency: business?.currency,
          description: note || undefined,
          customerName: customerName || undefined,
          customerEmail: customerEmail || undefined,
        },
        { skip401Redirect: true }
      );
      if (res?.success && res.data) {
        const redirectUrl = res.data.payUrl ?? res.data.paymentUrl;
        if (redirectUrl) {
          router.push(redirectUrl);
        } else {
          setSubmitError(t("pay.requestFailed"));
        }
      } else {
        setSubmitError(t("pay.requestFailed"));
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("pay.paymentFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingBusiness) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
          <Link href="/" className="mb-8 inline-flex">
            <Logo />
          </Link>
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </div>
        <PayFooter />
      </div>
    );
  }

  if (notFound || !business) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
          <Link href="/" className="mb-8 inline-flex">
            <Logo />
          </Link>
          <div className="flex flex-1 flex-col items-center justify-center rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
            <h1 className="mb-2 text-xl font-bold text-dark dark:text-white">
              Business not found
            </h1>
            <p className="mb-6 text-center text-body-sm text-dark-4 dark:text-dark-6">
              The storefront you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <Link
              href="/auth/sign-up"
              className="block w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-white hover:bg-primary/90"
            >
              Create your own storefront
            </Link>
          </div>
        </div>
        <PayFooter />
      </div>
    );
  }

  const currency =
    business.currency ?? getCurrencyForCountry(business.countryCode ?? "");

  return (
    <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <Link href="/" className="mb-8 inline-flex">
          <Logo />
        </Link>

        <div className="flex flex-1 flex-col rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
          {/* Business header */}
          <div className="border-b border-stroke p-6 dark:border-dark-3 sm:p-8">
            <div className="flex items-center gap-4">
              {business.logoUrl && (
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border border-stroke dark:border-dark-3">
                  <Image
                    src={business.logoUrl}
                    alt={`${business.name ?? "Business"} logo`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
              <div>
                <h1 className="text-heading-4 font-bold text-dark dark:text-white">
                  {business.name ?? slug}
                </h1>
                {business.description && (
                  <p className="mt-1 text-body-sm text-dark-4 dark:text-dark-6">
                    {business.description}
                  </p>
                )}
              </div>
            </div>
            {(business.address || business.phone || business.taxId) && (
              <div className="mt-4 rounded-lg bg-gray-2 p-3 dark:bg-dark-2">
                <p className="mb-2 text-body-sm font-medium text-dark dark:text-white">
                  Verify you&apos;re paying the right business
                </p>
                <ul className="space-y-1 text-body-sm text-dark-4 dark:text-dark-6">
                  {business.address && (
                    <li>{business.address}</li>
                  )}
                  {business.phone && (
                    <li>{business.phone}</li>
                  )}
                  {business.taxId && (
                    <li>
                      {business.countryCode === "BJ"
                        ? `IFU: ${business.taxId}`
                        : `Tax ID: ${business.taxId}`}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Payment form */}
          <form onSubmit={handlePay} className="space-y-4 p-6 sm:p-8">
            <h2 className="text-base font-semibold text-dark dark:text-white">
              Make a payment
            </h2>

            {/* Amount */}
            <div>
              <label
                htmlFor="amount"
                className="mb-2 block text-body-sm font-medium text-dark dark:text-white"
              >
                Amount ({currency})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-dark-4">
                  {currency}
                </span>
                <input
                  id="amount"
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-stroke bg-transparent py-3 pl-14 pr-4 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                />
              </div>
            </div>

            {/* Description/note */}
            <div>
              <label
                htmlFor="note"
                className="mb-2 block text-body-sm font-medium text-dark dark:text-white"
              >
                Note{" "}
                <span className="font-normal text-dark-4">(optional)</span>
              </label>
              <input
                id="note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What is this payment for?"
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
              />
            </div>

            {/* Customer name */}
            <div>
              <label
                htmlFor="customerName"
                className="mb-2 block text-body-sm font-medium text-dark dark:text-white"
              >
                Your name{" "}
                <span className="font-normal text-dark-4">(optional)</span>
              </label>
              <input
                id="customerName"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Fatima Diallo"
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
              />
            </div>

            {/* Customer email */}
            <div>
              <label
                htmlFor="customerEmail"
                className="mb-2 block text-body-sm font-medium text-dark dark:text-white"
              >
                Your email{" "}
                <span className="font-normal text-dark-4">(optional)</span>
              </label>
              <input
                id="customerEmail"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="e.g. fatima@example.com"
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
              />
            </div>

            {submitError && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !amount}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-white transition hover:bg-primary/90 disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Processing…
                </>
              ) : (
                "Pay Now"
              )}
            </button>
          </form>
        </div>
      </div>

      <PayFooter />
    </div>
  );
}

export default function StorefrontPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-2 dark:bg-[#020d1a]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-dark-4 dark:text-dark-6">Loading…</p>
        </div>
      }
    >
      <StorefrontContent />
    </Suspense>
  );
}
