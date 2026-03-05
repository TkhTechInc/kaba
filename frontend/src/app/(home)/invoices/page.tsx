"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import InputGroup from "@/components/FormElements/InputGroup";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { standardFormat } from "@/lib/format-number";
import {
  createInvoicesApi,
  type CreateInvoiceInput,
  type Customer,
} from "@/services/invoices.service";
import { CustomerSelect } from "@/components/Invoices/CustomerSelect";
import { useEffect, useState } from "react";
import Link from "next/link";

const CURRENCIES = [
  { value: "NGN", label: "NGN" },
  { value: "GHS", label: "GHS" },
  { value: "XOF", label: "XOF" },
  { value: "XAF", label: "XAF" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

export default function InvoicesPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const [invoices, setInvoices] = useState<
    Awaited<ReturnType<ReturnType<typeof createInvoicesApi>["list"]>>["data"]["items"]
  >([]);
  const [customers, setCustomers] = useState<
    Awaited<ReturnType<ReturnType<typeof createInvoicesApi>["listCustomers"]>>["data"]["items"]
  >([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentLinkId, setPaymentLinkId] = useState<string | null>(null);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "sent" | "paid" | "overdue">("all");

  const [form, setForm] = useState<
    Omit<CreateInvoiceInput, 'earlyPaymentDiscountPercent' | 'earlyPaymentDiscountDays'> & {
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
    currency: "NGN",
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
      currency: features.currency ?? f.currency,
    }));
    api
      .list(businessId, page, 20)
      .then((r) => {
        setInvoices(r.data.items);
        setTotal(r.data.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [businessId, page, features.currency]);

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
      amount: form.amount + amount,
      itemDesc: "",
      itemQty: "1",
      itemPrice: "0",
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !form.customerId || form.items.length === 0) return;
    const total = form.items.reduce((s, i) => s + i.amount, 0);
    if (total <= 0) {
      setError("Add at least one line item with a price greater than zero");
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload: CreateInvoiceInput = {
      businessId,
      customerId: form.customerId,
      amount: form.items.reduce((s, i) => s + i.amount, 0),
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
      .then(() => {
        setForm((f) => ({
          ...f,
          items: [],
          amount: 0,
          itemDesc: "",
          itemQty: "1",
          itemPrice: "0",
        }));
        return api.list(businessId, 1, 20);
      })
      .then((r) => {
        setInvoices(r.data.items);
        setTotal(r.data.total);
        setPage(1);
      })
      .catch((e) => setError(e.message))
      .finally(() => setSubmitting(false));
  };

  const generatePaymentLink = (id: string) => {
    if (!businessId) return;
    api
      .generatePaymentLink(id, businessId)
      .then((r) => {
        setPaymentLinkId(id);
        setPaymentLinkUrl(r.paymentUrl);
      })
      .catch((e) => setError(e.message));
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="Invoices" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to view invoices.</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName="Invoices" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("invoicing")) {
    return (
      <>
        <Breadcrumb pageName="Invoices" />
        <UpgradePrompt feature="Invoicing" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Invoices" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
            <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
              <h3 className="font-semibold text-dark dark:text-white">Invoices</h3>
            </div>
            <div className="flex gap-1 overflow-x-auto border-b border-stroke px-6 py-2 dark:border-dark-3" role="tablist" aria-label="Filter invoices by status">
              {(["all", "draft", "sent", "paid", "overdue"] as const).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                    statusFilter === s
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-dark-4 hover:bg-gray-200 dark:bg-dark-2 dark:text-dark-6 dark:hover:bg-dark-3"
                  }`}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-6 text-center text-dark-6">Loading...</div>
              ) : (
                <Table role="table" aria-label="Invoices">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Due Date</TableHead>
                      <TableHead scope="col">Customer</TableHead>
                      <TableHead scope="col">Status</TableHead>
                      <TableHead scope="col" className="text-right">Amount</TableHead>
                      <TableHead scope="col">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-dark-6">
                          No invoices yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      invoices
                        .filter((inv) => statusFilter === "all" || inv.status === statusFilter)
                        .map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell>{inv.dueDate}</TableCell>
                          <TableCell>
                            {customers.find((c) => c.id === inv.customerId)?.name ?? inv.customerId}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                                  inv.status === "paid"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                    : inv.status === "overdue"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                    : inv.status === "sent"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                    : inv.status === "pending_approval"
                                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                                    : "bg-gray-100 text-gray-700 dark:bg-dark-2 dark:text-dark-6"
                                }`}
                              >
                                {inv.status === "pending_approval" ? "Pending Approval" : inv.status}
                              </span>
                              {/* MECeF DGI badge for Benin invoices */}
                              {inv.mecefStatus === "confirmed" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                                  title={`MECeF Serial: ${inv.mecefSerialNumber ?? ""}`}>
                                  ✓ DGI {inv.mecefSerialNumber ? `#${inv.mecefSerialNumber.slice(-8)}` : "Certified"}
                                </span>
                              )}
                              {inv.mecefStatus === "pending" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                                  ⏳ DGI Pending
                                </span>
                              )}
                              {inv.mecefStatus === "rejected" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                                  ✗ DGI Rejected
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {inv.currency} {standardFormat(inv.amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/invoices/${inv.id}`}
                                className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded text-sm font-medium"
                              >
                                Edit
                              </Link>
                              <span className="text-dark-4">|</span>
                              <button
                                type="button"
                                onClick={() => generatePaymentLink(inv.id)}
                                className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded text-sm"
                                aria-label={`Generate payment link for invoice ${inv.id}`}
                              >
                                Payment link
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
            {paymentLinkUrl && paymentLinkId && (
              <div className="border-t border-stroke p-4 dark:border-dark-3">
                <p className="mb-2 text-sm font-medium">Payment link:</p>
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
            {total > 20 && (
              <div className="flex justify-center gap-2 border-t border-stroke p-4 dark:border-dark-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="py-1 text-sm">
                  Page {page} of {Math.ceil(total / 20)}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(total / 20)}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark"
          >
            <h3 className="mb-1 font-semibold text-dark dark:text-white">Create Invoice</h3>
            <p className="mb-4 text-sm text-dark-6">
              Add a customer, line items with prices, then create. Each line needs a description, quantity, and unit price.
            </p>
            {error && (
              <div className="mb-4 rounded bg-red/10 p-3 text-sm text-red">{error}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
                  Customer
                </label>
                <CustomerSelect
                  customers={customers}
                  value={form.customerId}
                  onChange={(id) =>
                    setForm((f) => ({ ...f, customerId: id }))
                  }
                  onAddCustomer={(c) => setCustomers((prev) => [c, ...prev])}
                  createCustomer={(body) =>
                    api.createCustomer(body)
                  }
                  businessId={businessId}
                  placeholder="Search or select customer"
                />
              </div>
              <div>
                <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
                  Currency
                </label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="w-full rounded-lg border border-stroke bg-transparent px-5.5 py-3 dark:border-dark-3 dark:bg-dark-2"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <InputGroup
                label="Due Date"
                type="date"
                placeholder="YYYY-MM-DD"
                required
                value={form.dueDate}
                handleChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
              <div className="rounded-lg border border-dashed border-stroke p-3 dark:border-dark-3">
                <p className="mb-2 text-body-sm font-medium text-dark dark:text-white">
                  Early payment discount (optional)
                </p>
                <p className="mb-2 text-xs text-dark-6">
                  Offer a discount if customer pays within N days of invoice.
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="% off"
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
                    placeholder="Days"
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
              <div className="border-t border-stroke pt-4 dark:border-dark-3">
                <p className="mb-1 text-body-sm font-medium text-dark dark:text-white">
                  Line items (required)
                </p>
                <p className="mb-3 text-xs text-dark-6">
                  Add each product or service. Unit price must be greater than zero.
                </p>
                {form.items.length > 0 && (
                  <ul className="mb-3 space-y-1 text-sm text-dark-6">
                    {form.items.map((item, i) => (
                      <li key={i}>
                        {item.description} × {item.quantity} @ {form.currency}{" "}
                        {standardFormat(item.unitPrice)} = {form.currency}{" "}
                        {standardFormat(item.amount)}
                      </li>
                    ))}
                  </ul>
                )}
                {form.items.length > 0 && (
                  <p className="mb-3 text-sm font-medium text-dark dark:text-white">
                    Subtotal: {form.currency} {standardFormat(form.items.reduce((s, i) => s + i.amount, 0))}
                  </p>
                )}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      placeholder="Description (e.g. Consulting)"
                      value={form.itemDesc}
                      onChange={(e) => setForm((f) => ({ ...f, itemDesc: e.target.value }))}
                      className="min-w-[140px] flex-1 rounded border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      min={1}
                      value={form.itemQty}
                      onChange={(e) => setForm((f) => ({ ...f, itemQty: e.target.value }))}
                      className="w-16 rounded border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
                    />
                    <input
                      type="number"
                      placeholder="Unit price"
                      step={0.01}
                      value={form.itemPrice}
                      onChange={(e) => setForm((f) => ({ ...f, itemPrice: e.target.value }))}
                      className="w-24 rounded border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="w-full rounded border border-dashed border-stroke py-2.5 text-sm text-dark-4 hover:border-primary hover:text-primary dark:border-dark-3 dark:text-dark-6 dark:hover:border-primary dark:hover:text-primary"
                  >
                    + Add line item
                  </button>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting || form.items.length === 0 || form.items.reduce((s, i) => s + i.amount, 0) <= 0}
              className="mt-6 w-full rounded-lg bg-primary py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-busy={submitting}
            >
              {submitting ? "Creating..." : "Create Invoice"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
