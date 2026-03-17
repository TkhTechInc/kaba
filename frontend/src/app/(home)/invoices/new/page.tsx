"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import InputGroup from "@/components/FormElements/InputGroup";
import { CustomerSelect } from "@/components/Invoices/CustomerSelect";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { getCurrencyForCountry } from "@/lib/country-currency";
import { useLocale } from "@/contexts/locale-context";
import { Price } from "@/components/ui/Price";
import {
  createInvoicesApi,
  type CreateInvoiceInput,
  type Customer,
} from "@/services/invoices.service";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Currency locked to business default - change in Settings > Business Profile

export default function CreateInvoicePage() {
  const router = useRouter();
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const { t } = useLocale();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultCurrency = features.currency ?? getCurrencyForCountry(features.countryCode ?? "") ?? "XOF";
  const [form, setForm] = useState<
    Omit<CreateInvoiceInput, "earlyPaymentDiscountPercent" | "earlyPaymentDiscountDays"> & {
      itemDesc: string;
      itemQty: string;
      itemPrice: string;
      earlyPaymentDiscountPercent: string;
      earlyPaymentDiscountDays: string;
    }
  >({
    businessId: "",
    customerId: "",
    amount: 0,
    currency: defaultCurrency,
    dueDate: new Date().toISOString().slice(0, 10),
    items: [],
    status: "draft",
    itemDesc: "",
    itemQty: "1",
    itemPrice: "0",
    earlyPaymentDiscountPercent: "",
    earlyPaymentDiscountDays: "",
  });

  const api = createInvoicesApi(token);

  useEffect(() => {
    if (!businessId) return;
    setForm((f) => ({
      ...f,
      businessId,
      currency: features.currency ?? getCurrencyForCountry(features.countryCode ?? "") ?? f.currency,
    }));
    setLoading(false);
  }, [businessId, features.currency, features.countryCode]);

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
      setError(t("invoiceNew.lineItems.unitPriceError"));
      return;
    }
    setError(null);
    const amount = qty * price;
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          description: f.itemDesc.trim() || "Item",
          quantity: qty,
          unitPrice: price,
          amount,
        },
      ],
      amount: form.amount + amount,
      itemDesc: "",
      itemQty: "1",
      itemPrice: "0",
    }));
  };

  const removeItem = (index: number) => {
    const item = form.items[index];
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== index),
      amount: f.amount - (item?.amount ?? 0),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !form.customerId || form.items.length === 0) return;
    const total = form.items.reduce((s, i) => s + i.amount, 0);
    if (total <= 0) {
      setError(t("invoiceNew.lineItems.totalError"));
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload: CreateInvoiceInput = {
      businessId,
      customerId: form.customerId,
      amount: total,
      currency: form.currency,
      items: form.items,
      dueDate: form.dueDate,
      status: "draft",
      earlyPaymentDiscountPercent: form.earlyPaymentDiscountPercent
        ? Number(form.earlyPaymentDiscountPercent)
        : undefined,
      earlyPaymentDiscountDays: form.earlyPaymentDiscountDays
        ? Number(form.earlyPaymentDiscountDays)
        : undefined,
    };
    api
      .create(payload)
      .then((r) => {
        const rawId = r?.id;
        const id =
          rawId &&
          typeof rawId === "string" &&
          !rawId.startsWith("pending-") &&
          rawId !== "undefined" &&
          rawId !== "null"
            ? rawId
            : null;
        router.push(id ? `/invoices/${id}` : "/invoices");
      })
      .catch((e) => setError(e.message))
      .finally(() => setSubmitting(false));
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName={t("invoiceNew.pageName")} />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("invoiceNew.noBusinessSelected")}</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName={t("invoiceNew.pageName")} />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("invoicing")) {
    return (
      <>
        <Breadcrumb pageName={t("invoiceNew.pageName")} />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="mb-4 text-dark-6">{t("invoiceNew.notAvailable")}</p>
          <Link href="/invoices" className="text-primary hover:underline">
            {t("invoiceNew.backToInvoices")}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName={t("invoiceNew.pageName")} />

      <div className="mx-auto max-w-2xl">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark sm:p-8"
        >
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-heading-4 font-bold text-dark dark:text-white">
              {t("invoiceNew.title")}
            </h1>
            <Link
              href="/invoices"
              className="text-sm text-primary hover:underline"
            >
              {t("invoiceNew.cancel")}
            </Link>
          </div>
          <p className="mb-6 text-sm text-dark-6">
            {t("invoiceNew.subtitle")}
          </p>
          {error && (
            <div className="mb-6 rounded bg-red/10 p-3 text-sm text-red">{error}</div>
          )}
          <div className="space-y-6">
            <div>
              <label htmlFor="invoice-new-customer" className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
                {t("invoiceNew.customerLabel")}
              </label>
              <CustomerSelect
                id="invoice-new-customer"
                customers={customers}
                value={form.customerId}
                onChange={(id) => setForm((f) => ({ ...f, customerId: id }))}
                onAddCustomer={(c) => setCustomers((prev) => [c, ...prev])}
                createCustomer={(body) => api.createCustomer(body)}
                businessId={businessId}
                placeholder={t("invoiceNew.customerPlaceholder")}
              />
            </div>
            <div>
              <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
                {t("invoiceNew.currencyLabel")}
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
              label={t("invoiceNew.dueDateLabel")}
              type="date"
              placeholder="YYYY-MM-DD"
              required
              value={form.dueDate}
              handleChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
            <div className="rounded-lg border border-dashed border-stroke p-4 dark:border-dark-3">
              <p className="mb-2 text-body-sm font-medium text-dark dark:text-white">
                {t("invoiceNew.earlyDiscount.title")}
              </p>
              <p className="mb-3 text-xs text-dark-6">
                {t("invoiceNew.earlyDiscount.subtitle")}
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder={t("invoiceNew.earlyDiscount.percentOff")}
                  min={0}
                  max={100}
                  value={form.earlyPaymentDiscountPercent}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      earlyPaymentDiscountPercent: e.target.value,
                    }))
                  }
                  className="w-20 rounded border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
                />
                <input
                  type="number"
                  placeholder={t("invoiceNew.earlyDiscount.days")}
                  min={1}
                  value={form.earlyPaymentDiscountDays}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      earlyPaymentDiscountDays: e.target.value,
                    }))
                  }
                  className="w-20 rounded border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
                />
              </div>
            </div>
            <div className="border-t border-stroke pt-6 dark:border-dark-3">
              <p className="mb-2 text-body-sm font-medium text-dark dark:text-white">
                {t("invoiceNew.lineItems.title")}
              </p>
              <p className="mb-4 text-xs text-dark-6">
                {t("invoiceNew.lineItems.subtitle")}
              </p>
              {form.items.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {form.items.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-4 rounded-lg border border-stroke px-4 py-3 dark:border-dark-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm text-dark dark:text-white">
                          {item.description}
                        </p>
                        <p className="mt-0.5 text-xs text-dark-6">
                          {item.quantity} × <Price amount={item.unitPrice} currency={form.currency} /> ={" "}
                          <Price amount={item.amount} currency={form.currency} />
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="shrink-0 text-sm text-red hover:underline"
                      >
                        {t("invoiceNew.lineItems.remove")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {form.items.length > 0 && (
                <p className="mb-4 text-sm font-medium text-dark dark:text-white">
                  {t("invoiceNew.lineItems.subtotal")} <Price amount={form.items.reduce((s, i) => s + i.amount, 0)} currency={form.currency} />
                </p>
              )}
              <div className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
                  <div>
                    <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
                      {t("invoiceNew.lineItems.description")}
                    </label>
                    <input
                      type="text"
                      placeholder={t("invoiceNew.lineItems.descriptionPh")}
                      value={form.itemDesc}
                      onChange={(e) => setForm((f) => ({ ...f, itemDesc: e.target.value }))}
                      className="w-full min-w-0 rounded-lg border border-stroke px-4 py-2.5 dark:border-dark-3 dark:bg-dark-2"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
                      {t("invoiceNew.lineItems.qty")}
                    </label>
                    <input
                      type="number"
                      placeholder="1"
                      min={1}
                      value={form.itemQty}
                      onChange={(e) => setForm((f) => ({ ...f, itemQty: e.target.value }))}
                      className="w-20 rounded-lg border border-stroke px-3 py-2.5 dark:border-dark-3 dark:bg-dark-2"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
                      {t("invoiceNew.lineItems.unitPrice")}
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      step={0.01}
                      value={form.itemPrice}
                      onChange={(e) => setForm((f) => ({ ...f, itemPrice: e.target.value }))}
                      className="w-28 rounded-lg border border-stroke px-3 py-2.5 dark:border-dark-3 dark:bg-dark-2"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="w-full rounded-lg border border-dashed border-stroke py-3 text-sm text-dark-4 hover:border-primary hover:text-primary dark:border-dark-3 dark:text-dark-6 dark:hover:border-primary dark:hover:text-primary"
                >
                  {t("invoiceNew.lineItems.addItem")}
                </button>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={
              submitting ||
              form.items.length === 0 ||
              form.items.reduce((s, i) => s + i.amount, 0) <= 0
            }
            className="mt-8 w-full rounded-lg bg-primary py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-busy={submitting}
          >
            {submitting ? t("invoiceNew.submitting") : t("invoiceNew.submit")}
          </button>
        </form>
      </div>
    </>
  );
}
