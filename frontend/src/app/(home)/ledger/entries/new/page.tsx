"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import InputGroup from "@/components/FormElements/InputGroup";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Price } from "@/components/ui/Price";
import { getPhonePlaceholder } from "@/lib/country-dial-codes";
import {
  createLedgerApi,
  type CreateLedgerEntryInput,
  type LedgerEntryType,
} from "@/services/ledger.service";
import { createProductsApi, type Product } from "@/services/products.service";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CURRENCIES = [
  { value: "NGN", label: "NGN" },
  { value: "GHS", label: "GHS" },
  { value: "XOF", label: "XOF" },
  { value: "XAF", label: "XAF" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

export default function CreateEntryPage() {
  const router = useRouter();
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const permissions = usePermissions(businessId);
  const canWrite = permissions.ledger.canWrite;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

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

  const api = createLedgerApi(token);
  const productsApi = createProductsApi(token);

  useEffect(() => {
    if (!businessId) return;
    setForm((f) => ({
      ...f,
      businessId,
      currency: features.currency ?? f.currency,
    }));
  }, [businessId, features.currency]);

  useEffect(() => {
    if (!businessId || !features.isEnabled("inventory_lite")) return;
    productsApi
      .list(businessId, 1, 100)
      .then((r) => setProducts(r.data.items))
      .catch(() => setProducts([]));
  }, [businessId, features.isEnabled("inventory_lite")]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const useProduct = form.type === "sale" && form.productId && form.quantitySold;
    if (!businessId || !form.date) return;
    if (!useProduct && (!form.amount || form.amount <= 0)) return;
    setSubmitting(true);
    setError(null);
    setQueued(false);
    try {
      const result = await api.createEntry({
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
      });
      if (result.queued) {
        setQueued(true);
        setTimeout(() => router.push("/ledger"), 2000);
      } else {
        router.push("/ledger");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create entry");
    } finally {
      setSubmitting(false);
    }
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="Create Entry" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to create entries.</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName="Create Entry" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("ledger")) {
    return (
      <>
        <Breadcrumb pageName="Create Entry" />
        <UpgradePrompt feature="Ledger" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Create Entry" />

      <div className="mx-auto max-w-2xl">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark sm:p-8"
          aria-label="Create ledger entry"
        >
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-heading-4 font-bold text-dark dark:text-white">
              Create Entry
            </h1>
            <Link
              href="/ledger"
              className="text-sm text-primary hover:underline"
            >
              ← Cancel
            </Link>
          </div>

          {queued && (
            <div className="mb-6 rounded bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              Saved offline — will sync when connected.
            </div>
          )}
          {error && (
            <div className="mb-6 rounded bg-red/10 p-3 text-sm text-red">
              {error}
            </div>
          )}
          {!canWrite && (
            <div className="mb-6 rounded bg-gray-100 p-3 text-sm text-dark-6 dark:bg-dark-2">
              You have viewer access. Contact your admin to create entries.
            </div>
          )}

          <div className="space-y-5">
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

            {form.type === "sale" &&
              features.isEnabled("inventory_lite") &&
              products.length > 0 && (
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
                          description:
                            pid && p ? `${p.name} x 1` : f.description,
                        }));
                      }}
                      className="w-full rounded-lg border border-stroke bg-transparent px-5.5 py-3 dark:border-dark-3 dark:bg-dark-2"
                    >
                      <option value="">Manual entry</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({" "}
                          <Price amount={p.unitPrice} currency={p.currency} />)
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
                        const p = products.find(
                          (x) => x.id === form.productId
                        );
                        setForm((f) => ({
                          ...f,
                          quantitySold: qty,
                          amount: p ? p.unitPrice * qty : f.amount,
                          description: p
                            ? `${p.name} x ${qty}`
                            : f.description,
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
                  setForm((f) => ({
                    ...f,
                    amount: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            )}

            <div>
              <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
                Currency
              </label>
              <select
                value={form.currency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
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
              handleChange={(e) =>
                setForm((f) => ({ ...f, date: e.target.value }))
              }
            />
            <InputGroup
              label="Description"
              type="text"
              placeholder="Optional"
              value={form.description || ""}
              handleChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <InputGroup
              label="Category"
              type="text"
              placeholder="Optional"
              value={form.category || ""}
              handleChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
            />
            <InputGroup
              label="SMS Phone"
              type="text"
              placeholder={getPhonePlaceholder(features.countryCode)}
              value={form.smsPhone || ""}
              handleChange={(e) =>
                setForm((f) => ({ ...f, smsPhone: e.target.value }))
              }
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !canWrite}
            className="mt-8 w-full rounded-lg bg-primary py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-busy={submitting}
          >
            {submitting ? "Creating..." : "Create Entry"}
          </button>
        </form>
      </div>
    </>
  );
}
