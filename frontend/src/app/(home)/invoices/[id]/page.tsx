"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { standardFormat } from "@/lib/format-number";
import { createInvoicesApi, type Invoice, type Customer } from "@/services/invoices.service";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function InvoiceDetailPage() {
  const params = useParams();
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [paymentLinkError, setPaymentLinkError] = useState<string | null>(null);

  const id = params?.id as string;
  const api = createInvoicesApi(token);

  const canEdit = invoice && (invoice.status === "draft" || invoice.status === "pending_approval");
  const canGetPaymentLink =
    invoice &&
    invoice.status !== "paid" &&
    invoice.status !== "cancelled" &&
    invoice.amount > 0 &&
    features.isEnabled("payment_links");

  const handlePaymentLink = () => {
    if (!businessId || !id) return;
    setPaymentLinkError(null);
    api
      .generatePaymentLink(id, businessId)
      .then((r) => setPaymentLinkUrl(r.paymentUrl))
      .catch((e) => setPaymentLinkError(e.message));
  };

  useEffect(() => {
    if (!businessId || !id) return;
    api
      .getById(id, businessId)
      .then((r) => setInvoice(r.data))
      .catch((e) => {
        setError(e.message);
        setInvoice(null);
      })
      .finally(() => setLoading(false));
  }, [businessId, id]);

  useEffect(() => {
    if (!businessId) return;
    api
      .listCustomers(businessId, 1, 100)
      .then((r) => setCustomers(r.data.items))
      .catch(() => setCustomers([]));
  }, [businessId]);

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="Invoice" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to view invoices.</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName="Invoice" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("invoicing")) {
    return (
      <>
        <Breadcrumb pageName="Invoice" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Invoicing is not available on your plan.</p>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Breadcrumb pageName="Invoice" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (error || !invoice) {
    return (
      <>
        <Breadcrumb pageName="Invoice" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="mb-4 text-dark-6">{error ?? "Invoice not found"}</p>
          <Link href="/invoices" className="text-primary hover:underline">
            ← Back to Invoices
          </Link>
        </div>
      </>
    );
  }

  const customerName = customers.find((c) => c.id === invoice.customerId)?.name ?? invoice.customerId;

  return (
    <>
      <Breadcrumb pageName="Invoice" />

      <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-heading-4 font-bold text-dark dark:text-white">
            Invoice #{invoice.id.slice(0, 8)}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/invoices"
              className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              ← Back
            </Link>
            {canEdit && (
              <Link
                href={`/invoices/${id}/edit`}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                Edit
              </Link>
            )}
            {canGetPaymentLink && (
              <button
                type="button"
                onClick={handlePaymentLink}
                className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 dark:border-primary dark:text-primary"
              >
                Payment link
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-dark-6">Customer</p>
              <p className="text-dark dark:text-white">{customerName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-dark-6">Status</p>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  invoice.status === "paid"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : invoice.status === "overdue"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    : invoice.status === "sent"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    : "bg-gray-100 text-gray-700 dark:bg-dark-2 dark:text-dark-6"
                }`}
              >
                {invoice.status === "pending_approval" ? "Pending Approval" : invoice.status}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-dark-6">Due Date</p>
              <p className="text-dark dark:text-white">{invoice.dueDate}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-dark-6">Currency</p>
              <p className="text-dark dark:text-white">{invoice.currency}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-dark-6">Line items</p>
            <ul className="divide-y divide-stroke rounded-lg border border-stroke dark:divide-dark-3 dark:border-dark-3">
              {invoice.items.map((item, i) => (
                <li
                  key={i}
                  className="flex justify-between px-4 py-3 text-sm"
                >
                  <span className="text-dark dark:text-white">
                    {item.description} × {item.quantity} @ {invoice.currency}{" "}
                    {standardFormat(item.unitPrice)}
                  </span>
                  <span className="font-medium text-dark dark:text-white">
                    {invoice.currency} {standardFormat(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-stroke pt-4 dark:border-dark-3">
            <div className="flex justify-between text-lg font-semibold">
              <span className="text-dark dark:text-white">Total</span>
              <span className="text-dark dark:text-white">
                {invoice.currency} {standardFormat(invoice.amount)}
              </span>
            </div>
          </div>

          {paymentLinkError && (
            <div className="rounded bg-red/10 p-3 text-sm text-red">{paymentLinkError}</div>
          )}
          {paymentLinkUrl && (
            <div className="rounded-lg border border-stroke bg-gray-50 p-4 dark:border-dark-3 dark:bg-dark-2">
              <p className="mb-2 text-sm font-medium text-dark-6">Payment link (copy and share):</p>
              <a
                href={paymentLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-primary hover:underline"
              >
                {paymentLinkUrl}
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
