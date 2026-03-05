"use client";

import { Logo } from "@/components/logo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { standardFormat } from "@/lib/format-number";
import { apiGet } from "@/lib/api-client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface InvoicePayItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface InvoicePayData {
  businessName: string;
  invoiceNumber?: string;
  invoiceId?: string;
  id?: string;
  amount: number;
  currency: string;
  items?: InvoicePayItem[];
  status: string;
  paymentUrl?: string;
  dueDate?: string;
}

interface InvoicePayResponse {
  success: boolean;
  data: InvoicePayData;
}

function getInvoiceNumber(data: InvoicePayData): string {
  return (
    data.invoiceNumber ??
    data.invoiceId ??
    data.id?.slice(0, 8) ??
    "—"
  );
}

function isPaid(status: string): boolean {
  return status?.toLowerCase() === "paid";
}

function PayContent() {
  const params = useParams();
  const tokenParam = params?.token as string | undefined;

  const [data, setData] = useState<InvoicePayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenParam?.trim()) {
      setLoading(false);
      setError("Invalid payment link");
      return;
    }

    apiGet<InvoicePayResponse>(
      `/api/v1/invoices/pay/${encodeURIComponent(tokenParam)}`,
      { skip401Redirect: true }
    )
      .then((res) => {
        if (res?.success && res.data) {
          setData(res.data);
          setError(null);
        } else {
          setData(null);
          setError("Invalid or expired payment link");
        }
      })
      .catch((err) => {
        setData(null);
        setError(
          err instanceof Error ? err.message : "Invalid or expired payment link"
        );
      })
      .finally(() => setLoading(false));
  }, [tokenParam]);

  // No token
  if (!tokenParam?.trim()) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
          <Link href="/" className="mb-8 inline-flex">
            <Logo />
          </Link>
          <div className="flex flex-1 flex-col items-center justify-center rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
            <h1 className="mb-2 text-xl font-bold text-dark dark:text-white">
              Invalid payment link
            </h1>
            <p className="mb-6 text-center text-body-sm text-dark-4 dark:text-dark-6">
              This payment link is invalid or missing a token. Please check the
              link and try again.
            </p>
            <Link
              href="/auth/sign-up"
              className="block w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-white hover:bg-primary/90"
            >
              Create an account
            </Link>
          </div>
        </div>
        <PayFooter />
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
          <Link href="/" className="mb-8 inline-flex">
            <Logo />
          </Link>
          <div className="flex flex-1 flex-col rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
            <div className="mb-6 flex items-center gap-3">
              <Skeleton className="h-8 w-48" />
            </div>
            <div className="mb-6 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="mb-6 flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
        <PayFooter />
      </div>
    );
  }

  // Error
  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
          <Link href="/" className="mb-8 inline-flex">
            <Logo />
          </Link>
          <div className="flex flex-1 flex-col items-center justify-center rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
            <h1 className="mb-2 text-xl font-bold text-dark dark:text-white">
              Invalid or expired link
            </h1>
            <p className="mb-6 text-center text-body-sm text-dark-4 dark:text-dark-6">
              {error ?? "This payment link is invalid or has expired."}
            </p>
            <Link
              href="/auth/sign-up"
              className="block w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-white hover:bg-primary/90"
            >
              Create an account
            </Link>
          </div>
        </div>
        <PayFooter />
      </div>
    );
  }

  const paid = isPaid(data.status);
  const invoiceNumber = getInvoiceNumber(data);

  return (
    <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <Link href="/" className="mb-8 inline-flex">
          <Logo />
        </Link>

        <div className="flex flex-1 flex-col rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
          <div className="border-b border-stroke p-6 dark:border-dark-3 sm:p-8">
            <h1 className="text-heading-4 font-bold text-dark dark:text-white">
              Invoice #{invoiceNumber}
            </h1>
            <p className="mt-1 text-body-sm text-dark-4 dark:text-dark-6">
              {data.businessName}
            </p>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-dark-6">Amount</p>
                <p className="text-lg font-semibold text-dark dark:text-white">
                  {data.currency} {standardFormat(data.amount)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-dark-6">Status</p>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                    paid
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  }`}
                >
                  {paid ? "Paid" : "Unpaid"}
                </span>
              </div>
              {data.dueDate && (
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium text-dark-6">Due date</p>
                  <p className="text-dark dark:text-white">
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(data.dueDate))}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-dark-6">
                Line items
              </p>
              <div className="overflow-hidden rounded-lg border border-stroke dark:border-dark-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-dark-6">Description</TableHead>
                      <TableHead className="text-right text-dark-6">
                        Amount
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items?.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-dark dark:text-white">
                          {item.description}
                          {item.quantity > 1 && (
                            <span className="ml-1 text-dark-6">
                              × {item.quantity} @ {data.currency}{" "}
                              {standardFormat(item.unitPrice)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-dark dark:text-white">
                          {data.currency} {standardFormat(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-between border-t border-stroke pt-4 text-lg font-semibold dark:border-dark-3">
              <span className="text-dark dark:text-white">Total</span>
              <span className="text-dark dark:text-white">
                {data.currency} {standardFormat(data.amount)}
              </span>
            </div>

            {paid ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-900/40 dark:bg-green-900/20">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                  <svg
                    className="h-6 w-6 text-green-600 dark:text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="font-semibold text-green-800 dark:text-green-300">
                  Payment confirmed
                </p>
                <p className="text-center text-sm text-green-700 dark:text-green-400">
                  Thank you for your payment. This invoice has been marked as
                  paid.
                </p>
              </div>
            ) : (
              data.paymentUrl && (
                <a
                  href={data.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-white hover:bg-primary/90"
                >
                  Pay Now
                </a>
              )
            )}

            {!paid && !data.paymentUrl && (
              <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                Payment link is not available for this invoice. Please contact
                the business for payment instructions.
              </p>
            )}
          </div>
        </div>
      </div>

      <PayFooter />
    </div>
  );
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

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-2 dark:bg-[#020d1a]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-dark-4 dark:text-dark-6">Loading...</p>
        </div>
      }
    >
      <PayContent />
    </Suspense>
  );
}
