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
import {
  createProductsApi,
  type Product,
  type CreateProductInput,
} from "@/services/products.service";
import { useEffect, useState } from "react";

type StockoutForecast = {
  productId: string;
  productName: string;
  currentStock: number;
  avgDailySales: number;
  daysUntilStockout: number | null;
  predictedStockoutDate: string | null;
  confidence: 'high' | 'medium' | 'low';
  loanOffer?: {
    id: string;
    suggestedLoanAmount: number;
    suggestedReorderQuantity: number;
    currency: string;
    status: string;
  };
};

const CURRENCIES = [
  { value: "NGN", label: "NGN" },
  { value: "GHS", label: "GHS" },
  { value: "XOF", label: "XOF" },
  { value: "XAF", label: "XAF" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

export default function ProductsPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const permissions = usePermissions(businessId);
  const canWrite = permissions.inventory?.canWrite ?? false;
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forecastModal, setForecastModal] = useState<StockoutForecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [form, setForm] = useState<CreateProductInput & { id?: string }>({
    businessId: "",
    name: "",
    brand: "",
    unitPrice: 0,
    currency: "NGN",
    quantityInStock: 0,
    lowStockThreshold: 0,
  });

  const api = createProductsApi(token);

  const load = () => {
    if (!businessId) return;
    setLoading(true);
    api
      .list(businessId, page, 50)
      .then((r) => {
        setProducts(r.data.items);
        setTotal(r.data.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [businessId, page]);

  useEffect(() => {
    if (businessId) {
      setForm((f) => ({
        ...f,
        businessId,
        currency: features.currency ?? f.currency,
      }));
    }
  }, [businessId, features.currency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !form.name.trim()) return;
    setSubmitting(true);
    setError(null);
    const payload = {
      businessId,
      name: form.name.trim(),
      brand: form.brand?.trim() || undefined,
      unitPrice: Number(form.unitPrice) || 0,
      currency: form.currency,
      quantityInStock: Number(form.quantityInStock) || 0,
      lowStockThreshold:
        form.lowStockThreshold && Number(form.lowStockThreshold) > 0
          ? Number(form.lowStockThreshold)
          : undefined,
    };
    if (editingId) {
      api
        .update(editingId, { ...payload, businessId })
        .then(() => {
          setEditingId(null);
          setForm({
            businessId,
            name: "",
            brand: "",
            unitPrice: 0,
            currency: features.currency ?? "NGN",
            quantityInStock: 0,
            lowStockThreshold: 0,
          });
          load();
        })
        .catch((e) => setError(e.message))
        .finally(() => setSubmitting(false));
    } else {
      api
        .create(payload)
        .then(() => {
          setForm({
            businessId,
            name: "",
            brand: "",
            unitPrice: 0,
            currency: features.currency ?? "NGN",
            quantityInStock: 0,
            lowStockThreshold: 0,
          });
          load();
        })
        .catch((e) => setError(e.message))
        .finally(() => setSubmitting(false));
    }
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      businessId: p.businessId,
      name: p.name,
      brand: p.brand ?? "",
      unitPrice: p.unitPrice,
      currency: p.currency,
      quantityInStock: p.quantityInStock,
      lowStockThreshold: p.lowStockThreshold ?? 0,
    });
  };

  const handleDelete = (id: string) => {
    if (!businessId || !confirm("Delete this product?")) return;
    api
      .delete(businessId, id)
      .then(() => load())
      .catch((e) => setError(e.message));
  };

  const openForecast = async (product: Product) => {
    if (!businessId) return;
    setForecastLoading(true);
    setForecastModal({
      productId: product.id,
      productName: product.name,
      currentStock: product.quantityInStock,
      avgDailySales: 0,
      daysUntilStockout: null,
      predictedStockoutDate: null,
      confidence: 'low',
    });
    try {
      const r = await api.getStockoutForecast(businessId, product.id);
      setForecastModal(r.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load forecast");
      setForecastModal(null);
    } finally {
      setForecastLoading(false);
    }
  };

  const handleRestockLoan = async () => {
    if (!businessId || !forecastModal) return;
    try {
      const r = await api.createRestockLoan(businessId, forecastModal.productId);
      setForecastModal((prev) => prev ? { ...prev, loanOffer: r.data } : null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create loan offer");
    }
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="Products" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to manage products.</p>
        </div>
      </>
    );
  }

  if (!features.isEnabled("inventory_lite")) {
    return (
      <>
        <Breadcrumb pageName="Products" />
        <UpgradePrompt feature="Inventory" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Products" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
            <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
              <h3 className="font-semibold text-dark dark:text-white">
                Products
              </h3>
              <p className="mt-1 text-sm text-dark-6">
                Add items you sell. Use them when recording sales in the Ledger.
              </p>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-6 text-center text-dark-6">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Low Stock</TableHead>
                      {canWrite && <TableHead className="w-24">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={canWrite ? 6 : 5}
                          className="text-center text-dark-6"
                        >
                          No products yet. Add one below.
                        </TableCell>
                      </TableRow>
                    ) : (
                      products.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{p.brand || "—"}</TableCell>
                          <TableCell className="text-right">
                            {p.currency} {standardFormat(p.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.quantityInStock}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.lowStockThreshold ?? "—"}
                          </TableCell>
                          {canWrite && (
                            <TableCell>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => openForecast(p)}
                                  className="text-sm text-blue-600 hover:underline"
                                >
                                  Restock
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(p)}
                                  className="text-sm text-primary hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(p.id)}
                                  className="text-sm text-red hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>

        <div>
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark"
          >
            <h3 className="mb-4 font-semibold text-dark dark:text-white">
              {editingId ? "Edit Product" : "Add Product"}
            </h3>
            {error && (
              <div className="mb-4 rounded bg-red/10 p-3 text-sm text-red">
                {error}
              </div>
            )}
            <div className="space-y-4">
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
                value={String(form.quantityInStock || "")}
                handleChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    quantityInStock: parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
              <InputGroup
                label="Low Stock Alert (notify when below)"
                type="number"
                placeholder="Optional"
                value={
                  form.lowStockThreshold
                    ? String(form.lowStockThreshold)
                    : ""
                }
                handleChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    lowStockThreshold: parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                disabled={submitting || !canWrite}
                className="flex-1 rounded-lg bg-primary py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting
                  ? "Saving..."
                  : editingId
                    ? "Update"
                    : "Add Product"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm({
                      businessId,
                      name: "",
                      brand: "",
                      unitPrice: 0,
                      currency: features.currency ?? "NGN",
                      quantityInStock: 0,
                      lowStockThreshold: 0,
                    });
                  }}
                  className="rounded-lg border border-stroke px-4 py-3 dark:border-dark-3"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Stockout Forecast & Restock Loan Modal */}
      {forecastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-dark dark:text-white">
                Restock Forecast — {forecastModal.productName}
              </h3>
              <button onClick={() => setForecastModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {forecastLoading ? (
              <p className="py-8 text-center text-gray-500">Analysing sales data…</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded bg-gray-50 p-3 dark:bg-dark-2">
                    <p className="text-xs text-gray-500">Current Stock</p>
                    <p className="text-lg font-bold">{forecastModal.currentStock}</p>
                  </div>
                  <div className="rounded bg-gray-50 p-3 dark:bg-dark-2">
                    <p className="text-xs text-gray-500">Avg Daily Sales</p>
                    <p className="text-lg font-bold">{forecastModal.avgDailySales.toFixed(1)}</p>
                  </div>
                  <div className="rounded bg-gray-50 p-3 dark:bg-dark-2">
                    <p className="text-xs text-gray-500">Days Until Stockout</p>
                    <p className="text-lg font-bold">
                      {forecastModal.daysUntilStockout !== null ? forecastModal.daysUntilStockout : "N/A"}
                    </p>
                  </div>
                  <div className="rounded bg-gray-50 p-3 dark:bg-dark-2">
                    <p className="text-xs text-gray-500">Predicted Date</p>
                    <p className="text-sm font-bold">
                      {forecastModal.predictedStockoutDate ?? "Insufficient data"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Confidence:</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    forecastModal.confidence === 'high' ? 'bg-green-100 text-green-800'
                    : forecastModal.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                  }`}>
                    {forecastModal.confidence}
                  </span>
                </div>

                {forecastModal.loanOffer ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <p className="font-medium text-green-800">Sika Restock Credit Offered!</p>
                    <p className="text-sm text-green-700 mt-1">
                      Reorder <strong>{forecastModal.loanOffer.suggestedReorderQuantity}</strong> units
                      — Loan amount: <strong>{forecastModal.loanOffer.currency} {standardFormat(forecastModal.loanOffer.suggestedLoanAmount)}</strong>
                    </p>
                    <p className="text-xs text-green-600 mt-1">Status: {forecastModal.loanOffer.status}</p>
                  </div>
                ) : forecastModal.avgDailySales > 0 ? (
                  <button
                    type="button"
                    onClick={handleRestockLoan}
                    className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Request Sika Restock Credit
                  </button>
                ) : (
                  <p className="text-xs text-gray-500 text-center">
                    Not enough sales history to offer a restock loan.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
