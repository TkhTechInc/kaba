"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { Price } from "@/components/ui/Price";
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
  const [whatsappDirectLoading, setWhatsappDirectLoading] = useState(false);
  const [whatsappShareLoading, setWhatsappShareLoading] = useState(false);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [whatsappSent, setWhatsappSent] = useState(false);

  const id = params?.id as string;
  const api = createInvoicesApi(token);

  const canEdit = invoice && (invoice.status === "draft" || invoice.status === "pending_approval");
  const canGetPaymentLink =
    invoice &&
    invoice.status !== "paid" &&
    invoice.status !== "cancelled" &&
    invoice.amount > 0 &&
    features.isEnabled("payment_links");

  const invoiceEligibleForWhatsApp =
    invoice &&
    invoice.status !== "paid" &&
    invoice.status !== "cancelled";
  const canShareViaWhatsApp = invoiceEligibleForWhatsApp;
  const canSendToCustomer =
    invoiceEligibleForWhatsApp && features.isEnabled("whatsapp_invoice_delivery");

  const handlePaymentLink = () => {
    if (!businessId || !id) return;
    setPaymentLinkError(null);
    api
      .generatePaymentLink(id, businessId)
      .then((r) => setPaymentLinkUrl(r.paymentUrl))
      .catch((e) => setPaymentLinkError(e.message));
  };

  const handleWhatsAppDirect = async () => {
    if (!businessId || !id) return;
    setWhatsappError(null);
    setWhatsappSent(false);
    setWhatsappDirectLoading(true);
    try {
      const result = await api.sendWhatsApp(id, businessId);
      if (result?.success) {
        setWhatsappSent(true);
      } else {
        setWhatsappError("Direct send failed. Use Share link to send manually.");
      }
    } catch (e) {
      setWhatsappError(
        e instanceof Error ? e.message : "WhatsApp API not configured. Use Share link instead."
      );
    } finally {
      setWhatsappDirectLoading(false);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!businessId || !id) return;
    setWhatsappError(null);
    setWhatsappShareLoading(true);
    try {
      const url = await api.getWhatsAppLink(id, businessId);
      window.open(url, "_blank");
    } catch (e) {
      setWhatsappError(e instanceof Error ? e.message : "Failed to get WhatsApp link");
    } finally {
      setWhatsappShareLoading(false);
    }
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
            {canShareViaWhatsApp && (
              <button
                type="button"
                onClick={handleWhatsAppShare}
                disabled={whatsappShareLoading}
                title="Open WhatsApp with pre-filled message to share manually"
                className="inline-flex items-center gap-2 rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-50 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-900/20 disabled:opacity-50"
              >
                {whatsappShareLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                    Opening…
                  </>
                ) : (
                  "Share via WhatsApp"
                )}
              </button>
            )}
            {canSendToCustomer && (
              <button
                type="button"
                onClick={handleWhatsAppDirect}
                disabled={whatsappDirectLoading}
                title="Send invoice directly to customer via WhatsApp (requires API setup)"
                className="inline-flex items-center gap-2 rounded-lg border border-green-600 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 dark:border-green-500 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-900/20 disabled:opacity-50"
              >
                {whatsappDirectLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                    Sending…
                  </>
                ) : (
                  "Send to customer"
                )}
              </button>
            )}
            {invoiceEligibleForWhatsApp && !canSendToCustomer && (
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                title="Upgrade to Pro or Enterprise to send invoices directly to customers"
              >
                Send to customer (Upgrade)
              </Link>
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
                    {item.description} × {item.quantity} @ <Price amount={item.unitPrice} currency={invoice.currency} />
                  </span>
                  <span className="font-medium text-dark dark:text-white">
                    <Price amount={item.amount} currency={invoice.currency} />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-stroke pt-4 dark:border-dark-3">
            <div className="flex justify-between text-lg font-semibold">
              <span className="text-dark dark:text-white">Total</span>
              <span className="text-dark dark:text-white">
                <Price amount={invoice.amount} currency={invoice.currency} />
              </span>
            </div>
          </div>

          {paymentLinkError && (
            <div className="rounded bg-red/10 p-3 text-sm text-red">{paymentLinkError}</div>
          )}
          {whatsappSent && (
            <div className="rounded bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              Invoice sent directly to customer via WhatsApp.
            </div>
          )}
          {whatsappError && (
            <div className="rounded bg-red/10 p-3 text-sm text-red">{whatsappError}</div>
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
