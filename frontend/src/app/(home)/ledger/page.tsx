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
import { usePermissions } from "@/hooks/use-permissions";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { standardFormat } from "@/lib/format-number";
import { getPhonePlaceholder } from "@/lib/country-dial-codes";
import { createLedgerApi } from "@/services/ledger.service";
import type { CreateLedgerEntryInput, LedgerEntryType } from "@/services/ledger.service";
import { createProductsApi } from "@/services/products.service";
import type { Product } from "@/services/products.service";
import { useEffect, useState } from "react";

const CURRENCIES = [
  { value: "NGN", label: "NGN" },
  { value: "GHS", label: "GHS" },
  { value: "XOF", label: "XOF" },
  { value: "XAF", label: "XAF" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

export default function LedgerPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const permissions = usePermissions(businessId);
  const canWrite = permissions.ledger.canWrite;
  const [entries, setEntries] = useState<Awaited<ReturnType<ReturnType<typeof createLedgerApi>["listEntries"]>>["data"]["items"]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [balance, setBalance] = useState<{ balance: number; currency: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "sale" | "expense">("all");

  const [form, setForm] = useState<CreateLedgerEntryInput & { smsPhone?: string }>({
    businessId: "",
    type: "sale",
    amount: 0,
    currency: "NGN",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    category: "",
    smsPhone: "",
    productId: "",
    quantitySold: undefined,
  });
  const [products, setProducts] = useState<Product[]>([]);

  const api = createLedgerApi(token);
  const productsApi = createProductsApi(token);

  useEffect(() => {
    if (!businessId) return;
    setForm((f) => ({
      ...f,
      businessId,
      currency: features.currency ?? f.currency,
    }));
    api
      .listEntries(businessId, page, 20)
      .then((r) => {
        setEntries(r.data.items);
        setTotal(r.data.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [businessId, page, features.currency]);

  useEffect(() => {
    if (!businessId) return;
    api
      .getBalance(businessId)
      .then((r) => setBalance(r.data))
      .catch(() => setBalance(null));
  }, [businessId, entries]);

  useEffect(() => {
    if (!businessId || !features.isEnabled("inventory_lite")) return;
    productsApi
      .list(businessId, 1, 100)
      .then((r) => setProducts(r.data.items))
      .catch(() => setProducts([]));
  }, [businessId, features.isEnabled("inventory_lite")]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const useProduct = form.type === "sale" && form.productId && form.quantitySold;
    if (!businessId || !form.date) return;
    if (!useProduct && (!form.amount || form.amount <= 0)) return;
    setSubmitting(true);
    setError(null);
    api
      .createEntry({
        businessId,
        type: form.type as LedgerEntryType,
        amount: useProduct ? 0 : Number(form.amount),
        currency: form.currency,
        date: form.date,
        description: form.description || undefined,
        category: form.category || undefined,
        smsPhone: form.smsPhone || undefined,
        productId: useProduct ? form.productId : undefined,
        quantitySold: useProduct ? Number(form.quantitySold) : undefined,
      })
      .then(() => {
        setForm((f) => ({
          ...f,
          amount: 0,
          description: "",
          category: "",
          smsPhone: "",
          productId: "",
          quantitySold: undefined,
        }));
        return api.listEntries(businessId, 1, 20);
      })
      .then((r) => {
        setEntries(r.data.items);
        setTotal(r.data.total);
        setPage(1);
      })
      .catch((e) => setError(e.message))
      .finally(() => setSubmitting(false));
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="Ledger" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to view the ledger.</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName="Ledger" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("ledger")) {
    return (
      <>
        <Breadcrumb pageName="Ledger" />
        <UpgradePrompt feature="Ledger" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Ledger" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
            <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
              <h3 className="font-semibold text-dark dark:text-white">Entries</h3>
              {balance && (
                <p className="mt-1 text-sm text-dark-6">
                  Balance: {balance.currency} {standardFormat(balance.balance)}
                </p>
              )}
            </div>
            <div className="flex gap-1 border-b border-stroke px-6 py-2 dark:border-dark-3" role="tablist" aria-label="Filter by transaction type">
              {(["all", "sale", "expense"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={typeFilter === t}
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                    typeFilter === t
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-dark-4 hover:bg-gray-200 dark:bg-dark-2 dark:text-dark-6 dark:hover:bg-dark-3"
                  }`}
                >
                  {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-6 text-center text-dark-6" role="status" aria-live="polite">Loading...</div>
              ) : (
                <Table role="table" aria-label="Ledger entries">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Date</TableHead>
                      <TableHead scope="col">Type</TableHead>
                      <TableHead scope="col">Description</TableHead>
                      <TableHead scope="col">Category</TableHead>
                      <TableHead scope="col" className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-dark-6">
                          No entries yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      entries
                        .filter((e) => typeFilter === "all" || e.type === typeFilter)
                        .map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{e.date}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                                e.type === "sale"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                              }`}
                            >
                              {e.type === "sale" ? "↑ Sale" : "↓ Expense"}
                            </span>
                          </TableCell>
                          <TableCell>{e.description || "—"}</TableCell>
                          <TableCell>{e.category || "—"}</TableCell>
                          <TableCell className="text-right">
                            {e.type === "expense" ? "-" : ""}
                            {e.currency} {standardFormat(e.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
            {total > 20 && (
              <div className="flex justify-center gap-2 border-t border-stroke p-4 dark:border-dark-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  aria-label="Previous page"
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
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  aria-label="Next page"
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
            aria-label="Create ledger entry"
          >
            <h3 id="create-entry-heading" className="mb-4 font-semibold text-dark dark:text-white">Create Entry</h3>
            {!canWrite && (
              <p className="mb-4 text-sm text-dark-6">You have viewer access. Contact your admin to create entries.</p>
            )}
            {error && (
              <div className="mb-4 rounded bg-red/10 p-3 text-sm text-red">{error}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as LedgerEntryType,
                      productId: "",
                      quantitySold: undefined,
                    }))
                  }
                  className="w-full rounded-lg border border-stroke bg-transparent px-5.5 py-3 dark:border-dark-3 dark:bg-dark-2"
                >
                  <option value="sale">Sale</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              {form.type === "sale" && features.isEnabled("inventory_lite") && products.length > 0 && (
                <>
                  <div>
                    <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
                      Product (optional)
                    </label>
                    <select
                      value={form.productId || ""}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const p = products.find((x) => x.id === pid);
                        setForm((f) => ({
                          ...f,
                          productId: pid,
                          quantitySold: pid ? 1 : undefined,
                          amount: pid && p ? p.unitPrice : f.amount,
                          description: pid && p ? `${p.name} x 1` : f.description,
                        }));
                      }}
                      className="w-full rounded-lg border border-stroke bg-transparent px-5.5 py-3 dark:border-dark-3 dark:bg-dark-2"
                    >
                      <option value="">Manual entry</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.currency} {standardFormat(p.unitPrice)})
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.productId && (
                    <InputGroup
                      label="Quantity sold"
                      type="number"
                      placeholder="1"
                      required
                      value={String(form.quantitySold || "")}
                      handleChange={(e) => {
                        const qty = parseInt(e.target.value, 10) || 0;
                        const p = products.find((x) => x.id === form.productId);
                        setForm((f) => ({
                          ...f,
                          quantitySold: qty,
                          amount: p ? p.unitPrice * qty : f.amount,
                          description: p ? `${p.name} x ${qty}` : f.description,
                        }));
                      }}
                    />
                  )}
                </>
              )}
              {(!form.productId || form.type === "expense") && (
                <InputGroup
                  label="Amount"
                  type="number"
                  placeholder="0"
                  required={!form.productId}
                  value={String(form.amount || "")}
                  handleChange={(e) =>
                    setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))
                  }
                />
              )}
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
                label="Date"
                type="date"
                placeholder="YYYY-MM-DD"
                required
                value={form.date}
                handleChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
              <InputGroup
                label="Description"
                type="text"
                placeholder="Optional"
                value={form.description || ""}
                handleChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <InputGroup
                label="Category"
                type="text"
                placeholder="Optional"
                value={form.category || ""}
                handleChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
              <InputGroup
                label="SMS Phone"
                type="text"
                placeholder={getPhonePlaceholder(features.countryCode)}
                value={form.smsPhone || ""}
                handleChange={(e) => setForm((f) => ({ ...f, smsPhone: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !canWrite}
              className="mt-6 w-full rounded-lg bg-primary py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-busy={submitting}
            >
              {submitting ? "Creating..." : "Create Entry"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
