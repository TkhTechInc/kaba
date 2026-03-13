"use client";

import { Logo } from "@/components/logo";
import { Price } from "@/components/ui/Price";
import { AgentChatWidget } from "@/components/mcp";
import { apiGet } from "@/lib/api-client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";

interface PortalCustomer {
  customerId: string;
  name: string;
}

interface PortalInvoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  dueDate?: string;
  createdAt: string;
  payUrl?: string;
}

interface LookupResponse {
  success: boolean;
  data: PortalCustomer;
}

interface InvoicesResponse {
  success: boolean;
  data: { items: PortalInvoice[] };
}

type View = "email" | "invoices";

const STATUS_LABELS: Record<string, string> = {
  sent: "Unpaid",
  overdue: "Overdue",
  paid: "Paid",
  pending_approval: "Pending",
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "overdue":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "sent":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
      new Date(dateStr)
    );
  } catch {
    return dateStr;
  }
}

function PortalFooter() {
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

function PortalContent() {
  const params = useParams();
  const businessId = params?.businessId as string | undefined;

  const [view, setView] = useState<View>("email");
  const [email, setEmail] = useState("");
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId?.trim() || !email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiGet<LookupResponse>(
        `/api/v1/customers/portal/lookup?businessId=${encodeURIComponent(businessId)}&email=${encodeURIComponent(email.trim())}`,
        { skip401Redirect: true }
      );

      if (!res?.success || !res.data?.customerId) {
        setError("No account found with that email. Please check and try again.");
        setLoading(false);
        return;
      }

      const foundCustomer = res.data;
      setCustomer(foundCustomer);

      const invRes = await apiGet<InvoicesResponse>(
        `/api/v1/customers/portal/invoices?businessId=${encodeURIComponent(businessId)}&customerId=${encodeURIComponent(foundCustomer.customerId)}`,
        { skip401Redirect: true }
      );

      setInvoices(invRes?.data?.items ?? []);
      setView("invoices");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.toLowerCase().includes("not found") || msg.includes("404")) {
        setError("No account found with that email. Please check and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setView("email");
    setCustomer(null);
    setInvoices([]);
    setError(null);
  }

  if (!businessId?.trim()) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
          <Link href="/" className="mb-8 inline-flex">
            <Logo />
          </Link>
          <div className="flex flex-1 flex-col items-center justify-center rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
            <h1 className="mb-2 text-xl font-bold text-dark dark:text-white">
              Invalid portal link
            </h1>
            <p className="text-center text-body-sm text-dark-4 dark:text-dark-6">
              This portal link is missing a business ID. Please contact the business for a valid link.
            </p>
          </div>
        </div>
        <PortalFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-2 px-4 py-8 dark:bg-[#020d1a]">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <Link href="/" className="mb-8 inline-flex">
          <Logo />
        </Link>

        {view === "email" && (
          <div className="flex flex-1 flex-col rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
            <div className="border-b border-stroke p-6 dark:border-dark-3 sm:p-8">
              <h1 className="text-heading-4 font-bold text-dark dark:text-white">
                Customer Portal
              </h1>
              <p className="mt-1 text-body-sm text-dark-4 dark:text-dark-6">
                Enter your email to view your invoices
              </p>
            </div>

            <form onSubmit={handleLookup} className="space-y-5 p-6 sm:p-8">
              <div>
                <label
                  htmlFor="portal-email"
                  className="mb-2 block text-sm font-medium text-dark dark:text-white"
                >
                  Email address
                </label>
                <input
                  id="portal-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-stroke bg-white px-4 py-3 text-dark outline-none placeholder:text-dark-6 focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:placeholder:text-dark-4 dark:focus:border-primary"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {loading ? "Looking up…" : "View my invoices"}
              </button>
            </form>
          </div>
        )}

        {view === "invoices" && customer && (
          <div className="flex flex-1 flex-col rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
            <div className="border-b border-stroke p-6 dark:border-dark-3 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-heading-4 font-bold text-dark dark:text-white">
                    Hello, {customer.name}
                  </h1>
                  <p className="mt-1 text-body-sm text-dark-4 dark:text-dark-6">
                    Your invoices
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-sm text-primary hover:underline"
                >
                  Back
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                    <svg
                      className="h-7 w-7 text-dark-4 dark:text-dark-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <p className="font-medium text-dark dark:text-white">
                    No invoices found
                  </p>
                  <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
                    You have no active invoices from this business.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-stroke dark:divide-dark-3">
                  {invoices.map((invoice) => {
                    const isPaid = invoice.status === "paid";
                    const isPayable =
                      invoice.status === "sent" || invoice.status === "overdue";

                    return (
                      <li
                        key={invoice.id}
                        className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-dark dark:text-white">
                              Invoice #{invoice.id.slice(0, 8)}
                            </span>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(invoice.status)}`}
                            >
                              {STATUS_LABELS[invoice.status] ?? invoice.status}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-dark-4 dark:text-dark-6">
                            <span>
                              <Price
                                amount={invoice.amount}
                                currency={invoice.currency}
                              />
                            </span>
                            {invoice.dueDate && (
                              <span>Due {formatDate(invoice.dueDate)}</span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                              <svg
                                className="h-4 w-4"
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
                              Paid
                            </span>
                          ) : isPayable && invoice.payUrl ? (
                            <a
                              href={invoice.payUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                            >
                              Pay Now
                            </a>
                          ) : isPayable ? (
                            <span className="text-sm text-dark-4 dark:text-dark-6">
                              Contact business to pay
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <PortalFooter />

      {customer && businessId && (
        <AgentChatWidget
          token={null}
          businessId={businessId}
          customerEmail={email}
          mode="portal"
        />
      )}
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-2 dark:bg-[#020d1a]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-dark-4 dark:text-dark-6">Loading...</p>
        </div>
      }
    >
      <PortalContent />
    </Suspense>
  );
}
