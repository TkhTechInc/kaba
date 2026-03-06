"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { apiPost } from "@/lib/api-client";

function KkiaPayReturnContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const transactionId =
    searchParams.get("transaction_id") ?? searchParams.get("transactionId");
  // KkiaPay may add status to redirect URL. For testing failed tx: add ?transaction_status=failed
  const redirectStatus =
    searchParams.get("transaction_status") ??
    searchParams.get("status") ??
    searchParams.get("event");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token || !transactionId) {
      setStatus("error");
      setMessage("Missing payment details. Return to the invoice and try again.");
      return;
    }
    apiPost<{ success: boolean }>(
      "/api/v1/invoices/pay/confirm-kkiapay",
      { token, transactionId, ...(redirectStatus && { redirectStatus }) },
      { skip401Redirect: true }
    )
      .then((res) => {
        if (res?.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setMessage("Payment confirmation failed.");
        }
      })
      .catch((err) => {
        setStatus("error");
        const msg = err instanceof Error ? err.message : "Could not confirm payment.";
        setMessage(msg);
      });
  }, [token, transactionId, redirectStatus]);

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
              Payment confirmed
            </h1>
            <p className="mt-1 text-center text-sm text-dark-4 dark:text-dark-6">
              Thank you for your payment. The invoice has been marked as paid.
            </p>
            <div className="mt-6 flex w-full flex-col gap-3">
              <Link
                href="/"
                className="block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-white hover:bg-primary/90"
              >
                Done
              </Link>
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
            {token && (
              <Link
                href={`/pay/${token}`}
                className="block w-full rounded-lg border border-amber-300 py-2.5 text-center text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
              >
                Back to invoice
              </Link>
            )}
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

export default function KkiaPayReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-2 dark:bg-[#020d1a]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-dark-4 dark:text-dark-6">Loading…</p>
        </div>
      }
    >
      <KkiaPayReturnContent />
    </Suspense>
  );
}
