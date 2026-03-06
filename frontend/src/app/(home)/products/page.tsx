"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Price } from "@/components/ui/Price";
import { createProductsApi, type Product } from "@/services/products.service";
import { PaginationWithPageSize } from "@/components/ui/pagination-with-page-size";
import Link from "next/link";
import { useEffect, useState } from "react";

type StockoutForecast = {
  productId: string;
  productName: string;
  currentStock: number;
  avgDailySales: number;
  daysUntilStockout: number | null;
  predictedStockoutDate: string | null;
  confidence: "high" | "medium" | "low";
  loanOffer?: {
    id: string;
    suggestedLoanAmount: number;
    suggestedReorderQuantity: number;
    currency: string;
    status: string;
  };
};

export default function ProductsPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const permissions = usePermissions(businessId);
  const canWrite = permissions.inventory?.canWrite ?? false;
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecastModal, setForecastModal] = useState<StockoutForecast | null>(
    null
  );
  const [forecastLoading, setForecastLoading] = useState(false);

  const api = createProductsApi(token);

  const load = () => {
    if (!businessId) return;
    setError(null);
    setLoading(true);
    api
      .list(businessId, page, limit)
      .then((r) => {
        setProducts(r.data.items);
        setTotal(r.data.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [businessId, page, limit]);

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
      confidence: "low",
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
      const r = await api.createRestockLoan(
        businessId,
        forecastModal.productId
      );
      setForecastModal((prev) => (prev ? { ...prev, loanOffer: r } : null));
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to create loan offer"
      );
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

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName="Products" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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

      {error && (
        <div className="mb-4 rounded bg-red/10 p-3 text-sm text-red">
          {error}
        </div>
      )}

      <div className="min-w-0 rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stroke px-4 py-3 dark:border-dark-3 sm:px-6 sm:py-4">
          <div>
            <h3 className="font-semibold text-dark dark:text-white">
              Products
            </h3>
            <p className="mt-1 text-sm text-dark-6">
              Add items you sell. Use them when recording sales in the Ledger.
            </p>
          </div>
          {canWrite && (
            <Link
              href="/products/new"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              + Add Product
            </Link>
          )}
        </div>

        <div className="-mx-4 sm:mx-0">
          {loading ? (
            <div className="p-6 text-center text-dark-6">Loading...</div>
          ) : (
            <ResponsiveDataList<Product>
              items={products}
              keyExtractor={(p) => p.id}
              emptyMessage={
                canWrite ? (
                  <>
                    No products yet.{" "}
                    <Link href="/products/new" className="text-primary hover:underline">
                      Add your first product.
                    </Link>
                  </>
                ) : (
                  "No products yet."
                )
              }
              columns={[
                { key: "name", label: "Name", render: (p) => p.name, prominent: true },
                { key: "brand", label: "Brand", render: (p) => p.brand || "—" },
                {
                  key: "price",
                  label: "Price",
                  render: (p) => <Price amount={p.unitPrice} currency={p.currency} />,
                  align: "right",
                },
                {
                  key: "stock",
                  label: "Stock",
                  render: (p) => String(p.quantityInStock),
                  align: "right",
                },
                {
                  key: "lowStock",
                  label: "Low Stock",
                  render: (p) => p.lowStockThreshold ?? "—",
                  align: "right",
                },
              ]}
              renderActions={
                canWrite
                  ? (p) => (
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openForecast(p)}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          Restock
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="text-sm font-medium text-red hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    )
                  : undefined
              }
            />
          )}
        </div>

        <PaginationWithPageSize
          page={page}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
          showWhenTotalExceeds={0}
        />
      </div>

      {/* Stockout Forecast & Restock Loan Modal */}
      {forecastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-dark dark:text-white">
                Restock Forecast — {forecastModal.productName}
              </h3>
              <button
                onClick={() => setForecastModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {forecastLoading ? (
              <p className="py-8 text-center text-gray-500">
                Analysing sales data…
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded bg-gray-50 p-3 dark:bg-dark-2">
                    <p className="text-xs text-gray-500">Current Stock</p>
                    <p className="text-lg font-bold">
                      {forecastModal.currentStock}
                    </p>
                  </div>
                  <div className="rounded bg-gray-50 p-3 dark:bg-dark-2">
                    <p className="text-xs text-gray-500">Avg Daily Sales</p>
                    <p className="text-lg font-bold">
                      {forecastModal.avgDailySales.toFixed(1)}
                    </p>
                  </div>
                  <div className="rounded bg-gray-50 p-3 dark:bg-dark-2">
                    <p className="text-xs text-gray-500">Days Until Stockout</p>
                    <p className="text-lg font-bold">
                      {forecastModal.daysUntilStockout !== null
                        ? forecastModal.daysUntilStockout
                        : "N/A"}
                    </p>
                  </div>
                  <div className="rounded bg-gray-50 p-3 dark:bg-dark-2">
                    <p className="text-xs text-gray-500">Predicted Date</p>
                    <p className="text-sm font-bold">
                      {forecastModal.predictedStockoutDate ??
                        "Insufficient data"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Confidence:</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      forecastModal.confidence === "high"
                        ? "bg-green-100 text-green-800"
                        : forecastModal.confidence === "medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {forecastModal.confidence}
                  </span>
                </div>

                {forecastModal.loanOffer ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <p className="font-medium text-green-800">
                      Sika Restock Credit Offered!
                    </p>
                    <p className="mt-1 text-sm text-green-700">
                      Reorder{" "}
                      <strong>
                        {forecastModal.loanOffer.suggestedReorderQuantity}
                      </strong>{" "}
                      units — Loan amount:{" "}
                      <strong>
                        <Price
                          amount={forecastModal.loanOffer.suggestedLoanAmount}
                          currency={forecastModal.loanOffer.currency}
                        />
                      </strong>
                    </p>
                    <p className="mt-1 text-xs text-green-600">
                      Status: {forecastModal.loanOffer.status}
                    </p>
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
                  <p className="text-center text-xs text-gray-500">
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
