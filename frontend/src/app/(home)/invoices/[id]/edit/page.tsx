"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import InputGroup from "@/components/FormElements/InputGroup";
import { CustomerSelect } from "@/components/Invoices/CustomerSelect";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { useFeatures } from "@/hooks/use-features";
import { getCurrencyForCountry } from "@/lib/country-currency";
import { Price } from "@/components/ui/Price";
import {
  createInvoicesApi,
  type CreateInvoiceInput,
  type Customer,
  type Invoice,
} from "@/services/invoices.service";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Currency locked to business default - change in Settings > Business Profile

export default function InvoiceEditPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLocale();
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<{
    customerId: string;
    currency: string;
    dueDate: string;
    items: CreateInvoiceInput["items"];
    itemDesc: string;
    itemQty: string;
    itemPrice: string;
    earlyPaymentDiscountPercent: string;
    earlyPaymentDiscountDays: string;
  }>({
    customerId: "",
    currency: features.currency ?? getCurrencyForCountry(features.countryCode ?? "") ?? "XOF", // Overwritten from invoice data when loaded
    dueDate: "",
    items: [],
    itemDesc: "",
    itemQty: "1",
    itemPrice: "0",
    earlyPaymentDiscountPercent: "",
    earlyPaymentDiscountDays: "",
  });

  const id = params?.id as string;
  const api = createInvoicesApi(token);

  useEffect(() => {
    if (!businessId || !id) return;
    api
      .getById(id, businessId)
      .then((r) => {
        const inv = r.data;
        setInvoice(inv);
        setForm({
          customerId: inv.customerId,
          currency: inv.currency,
          dueDate: inv.dueDate,
          items: inv.items,
          itemDesc: "",
          itemQty: "1",
          itemPrice: "0",
          earlyPaymentDiscountPercent: inv.earlyPaymentDiscountPercent?.toString() ?? "",
          earlyPaymentDiscountDays: inv.earlyPaymentDiscountDays?.toString() ?? "",
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [businessId, id]);

  useEffect(() => {
    if (!businessId) return;
    api
      .listCustomers(businessId, 1, 100)
      .then((r) => setCustomers(r.data.items))
      .catch(() => setCustomers([]));
  }, [businessId]);

  const addItem = () => {
    const qty = parseFloat(form.itemQty) || 1;
    const price = parseFloat(form.itemPrice) || 0;
    if (price <= 0) {
      setError("Unit price must be greater than zero");
      return;
    }
    setError(null);
    const amount = qty * price;
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          description: f.itemDesc || "Item",
          quantity: qty,
          unitPrice: price,
          amount,
        },
      ],
      itemDesc: "",
      itemQty: "1",
      itemPrice: "0",
    }));
  };

  const removeItem = (index: number) => {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !id || !form.customerId || form.items.length === 0) return;
    const total = form.items.reduce((s, i) => s + i.amount, 0);
    if (total <= 0) {
      setError("Add at least one line item with a price greater than zero");
      return;
    }
    setSubmitting(true);
    setError(null);
    api
      .update(id, businessId, {
        customerId: form.customerId,
        amount: total,
        currency: form.currency,
        items: form.items,
        dueDate: form.dueDate,
        earlyPaymentDiscountPercent: form.earlyPaymentDiscountPercent
          ? Number(form.earlyPaymentDiscountPercent)
          : undefined,
        earlyPaymentDiscountDays: form.earlyPaymentDiscountDays
          ? Number(form.earlyPaymentDiscountDays)
          : undefined,
      })
      .then(() => router.push(`/invoices/${id}`))
      .catch((e) => setError(e.message))
      .finally(() => setSubmitting(false));
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="Edit Invoice" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to edit invoices.</p>
        </div>
      </>
    );
  }

  if (features.loading || loading) {
    return (
      <>
        <Breadcrumb pageName="Edit Invoice" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("invoicing") || error) {
    return (
      <>
        <Breadcrumb pageName="Edit Invoice" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="mb-4 text-dark-6">{error ?? "Invoicing is not available on your plan."}</p>
          <Link href="/invoices" className="text-primary hover:underline">
            ← Back to Invoices
          </Link>
        </div>
      </>
    );
  }

  if (!invoice || (invoice.status !== "draft" && invoice.status !== "pending_approval")) {
    return (
      <>
        <Breadcrumb pageName="Edit Invoice" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="mb-4 text-dark-6">This invoice cannot be edited.</p>
          <Link href={`/invoices/${id}`} className="text-primary hover:underline">
            ← Back to Invoice
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Edit Invoice" />

      <div className="mx-auto max-w-2xl">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark"
        >
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-heading-4 font-bold text-dark dark:text-white">
              Edit Invoice #{id.slice(0, 8)}
            </h1>
            <Link
              href={`/invoices/${id}`}
              className="text-sm text-primary hover:underline"
            >
              ← Cancel
            </Link>
          </div>
          {error && (
            <div className="mb-4 rounded bg-red/10 p-3 text-sm text-red">{error}</div>
          )}
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
                Customer
              </label>
              <CustomerSelect
                customers={customers}
                value={form.customerId}
                onChange={(id) => setForm((f) => ({ ...f, customerId: id }))}
                onAddCustomer={(c) => setCustomers((prev) => [c, ...prev])}
                createCustomer={(body) => api.createCustomer(body)}
                businessId={businessId}
                placeholder="Search or select customer"
              />
            </div>
            <div>
              <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
                Currency
              </label>
              <div className="flex items-center justify-between rounded-lg border border-stroke bg-gray-2 px-4 py-2.5 dark:border-dark-3 dark:bg-dark-2">
                <span className="text-dark dark:text-white">{form.currency}</span>
                <Link
                  href="/settings/profile"
                  className="text-xs text-primary hover:underline"
                >
                  Change in settings
                </Link>
              </div>
            </div>
            <InputGroup
              label="Due Date"
              type="date"
              required
              placeholder=""
              value={form.dueDate}
              handleChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
            <div className="rounded-lg border border-dashed border-stroke p-3 dark:border-dark-3">
              <p className="mb-2 text-body-sm font-medium text-dark dark:text-white">
                Early payment discount (optional)
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="% off"
                  min={0}
                  max={100}
                  value={form.earlyPaymentDiscountPercent}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, earlyPaymentDiscountPercent: e.target.value }))
                  }
                  className="w-20 rounded border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
                />
                <input
                  type="number"
                  placeholder="Days"
                  min={1}
                  value={form.earlyPaymentDiscountDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, earlyPaymentDiscountDays: e.target.value }))
                  }
                  className="w-20 rounded border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
                />
              </div>
            </div>
            <div className="border-t border-stroke pt-4 dark:border-dark-3">
              <p className="mb-2 text-body-sm font-medium text-dark dark:text-white">
                Line items
              </p>
              {form.items.length > 0 && (
                <ul className="mb-3 space-y-2">
                  {form.items.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded border border-stroke px-3 py-2 dark:border-dark-3"
                    >
                      <span className="text-sm">
                        {item.description} × {item.quantity} @ <Price amount={item.unitPrice} currency={form.currency} /> = <Price amount={item.amount} currency={form.currency} />
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-red hover:underline text-sm"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {form.items.length > 0 && (
                <p className="mb-3 text-sm font-medium">
                  Subtotal: <Price amount={form.items.reduce((s, i) => s + i.amount, 0)} currency={form.currency} />
                </p>
              )}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="Description"
                    value={form.itemDesc}
                    onChange={(e) => setForm((f) => ({ ...f, itemDesc: e.target.value }))}
                    className="min-w-[120px] flex-1 rounded border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
                  />
                  <input
                    type="number"
                    placeholder={t("invoiceEdit.qty")}
                    min={1}
                    value={form.itemQty}
                    onChange={(e) => setForm((f) => ({ ...f, itemQty: e.target.value }))}
                    className="w-16 rounded border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
                  />
                    <input
                      type="number"
                      placeholder={t("invoiceEdit.unitPrice")}
                      step={0.01}
                      value={form.itemPrice}
                    onChange={(e) => setForm((f) => ({ ...f, itemPrice: e.target.value }))}
                    className="w-24 rounded border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
                  />
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="w-full rounded border border-dashed border-stroke py-2 text-sm text-dark-4 hover:border-primary hover:text-primary dark:border-dark-3 dark:hover:border-primary"
                >
                  {t("invoiceEdit.addLineItem")}
                </button>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || form.items.length === 0 || form.items.reduce((s, i) => s + i.amount, 0) <= 0}
            className="mt-6 w-full rounded-lg bg-primary py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? t("invoiceEdit.saving") : t("invoiceEdit.saveChanges")}
          </button>
        </form>
      </div>
    </>
  );
}
