"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import InputGroup from "@/components/FormElements/InputGroup";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import {
  createProductsApi,
  type CreateProductInput,
} from "@/services/products.service";
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

export default function AddProductPage() {
  const router = useRouter();
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const permissions = usePermissions(businessId);
  const canWrite = permissions.inventory?.canWrite ?? false;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const [form, setForm] = useState<CreateProductInput>({
    businessId: "",
    name: "",
    brand: "",
    unitPrice: 0,
    currency: "NGN",
    quantityInStock: 0,
    lowStockThreshold: 0,
  });

  const api = createProductsApi(token);

  useEffect(() => {
    if (businessId) {
      setForm((f) => ({
        ...f,
        businessId,
        currency: features.currency ?? f.currency,
      }));
    }
  }, [businessId, features.currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !form.name.trim()) return;
    setSubmitting(true);
    setError(null);
    setQueued(false);
    const payload = {
      businessId,
      name: form.name.trim(),
      brand: form.brand?.trim() || undefined,
      unitPrice: Number(form.unitPrice) || 0,
      currency: form.currency,
      quantityInStock: Math.round(Number(form.quantityInStock)) || 0,
      lowStockThreshold:
        form.lowStockThreshold && Number(form.lowStockThreshold) > 0
          ? Math.round(Number(form.lowStockThreshold))
          : undefined,
    };
    try {
      const result = await api.create(payload);
      if (result.queued) {
        setQueued(true);
        setTimeout(() => router.push("/products"), 2000);
      } else {
        router.push("/products");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add product");
    } finally {
      setSubmitting(false);
    }
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="Add Product" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to add products.</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName="Add Product" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("inventory_lite")) {
    return (
      <>
        <Breadcrumb pageName="Add Product" />
        <UpgradePrompt feature="Inventory" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Add Product" />

      <div className="mx-auto max-w-2xl">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark sm:p-8"
        >
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-heading-4 font-bold text-dark dark:text-white">
              Add Product
            </h1>
            <Link
              href="/products"
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
              You have viewer access. Contact your admin to add products.
            </div>
          )}

          <div className="space-y-5">
            <InputGroup
              label="Name"
              type="text"
              placeholder="e.g. Bag of Rice"
              required
              value={form.name}
              handleChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
            <InputGroup
              label="Brand"
              type="text"
              placeholder="Optional"
              value={form.brand || ""}
              handleChange={(e) =>
                setForm((f) => ({ ...f, brand: e.target.value }))
              }
            />
            <InputGroup
              label="Unit Price"
              type="number"
              placeholder="0"
              required
              value={String(form.unitPrice || "")}
              handleChange={(e) =>
                setForm((f) => ({
                  ...f,
                  unitPrice: parseFloat(e.target.value) || 0,
                }))
              }
            />
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
              label="Quantity in Stock"
              type="number"
              placeholder="0"
              required
              value={String(form.quantityInStock ?? "")}
              handleChange={(e) => {
                const raw = e.target.value.replace(/\s/g, "");
                const parsed = raw === "" ? 0 : Math.round(Number(raw)) || 0;
                setForm((f) => ({ ...f, quantityInStock: parsed }));
              }}
            />
            <InputGroup
              label="Low Stock Alert (notify when below)"
              type="number"
              placeholder="Optional"
              value={
                form.lowStockThreshold ? String(form.lowStockThreshold) : ""
              }
              handleChange={(e) =>
                setForm((f) => ({
                  ...f,
                  lowStockThreshold: parseInt(e.target.value, 10) || 0,
                }))
              }
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !canWrite}
            className="mt-8 w-full rounded-lg bg-primary py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-busy={submitting}
          >
            {submitting ? "Saving..." : "Add Product"}
          </button>
        </form>
      </div>
    </>
  );
}
