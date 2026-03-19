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
import { ListSearchInput } from "@/components/ui/list-search-input";
import Link from "next/link";
import { useLocale } from "@/contexts/locale-context";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { ApiError } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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
  const { t } = useLocale();
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const permissions = usePermissions(businessId);
  const searchParams = useSearchParams();
  const canWrite = permissions.inventory?.canWrite ?? false;
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [forecastModal, setForecastModal] = useState<StockoutForecast | null>(
    null
  );
  const [forecastLoading, setForecastLoading] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");

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
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : t("errors.loadProducts"));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [businessId, page, limit]);

  // Refresh when page becomes visible (e.g., after creating/editing product)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && businessId) {
        load();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [businessId, page, limit]);

  const handleDelete = (id: string) => {
    if (!businessId || !confirm(t("products.action.deleteConfirm"))) return;
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
      setError(e instanceof Error ? e.message : t("products.error.forecastFailed"));
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
        e instanceof Error ? e.message : t("products.error.loanFailed")
      );
    }
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName={t("products.title")} />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("products.noBusinessSelected")}</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName={t("products.title")} />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("inventory_lite")) {
    return (
      <>
        <Breadcrumb pageName={t("products.title")} />
        <UpgradePrompt feature="Inventory" />
      </>
    );
  }

  if (forbidden) {
    return (
      <>
        <Breadcrumb pageName={t("products.title")} />
        <PermissionDenied resource={t("permissionDenied.resource.products")} backHref="/" backLabel={t("common.goToDashboard")} />
      </>
    );
  }

  const query = search.trim().toLowerCase();
  const visibleProducts = query
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.brand ?? "").toLowerCase().includes(query)
      )
    : products;

  return (
    <>
      <Breadcrumb pageName={t("products.title")} />

      {error && (
        <div className="mb-4 rounded bg-red/10 p-3 text-sm text-red">
          {error}
        </div>
      )}

      <div className="min-w-0 rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke px-4 py-3 dark:border-dark-3 sm:px-6 sm:py-4">
          <div>
            <h3 className="font-semibold text-dark dark:text-white">
              {t("products.title")}
            </h3>
            <p className="mt-1 text-sm text-dark-6">
              {t("products.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ListSearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("products.search")}
            />
            {canWrite && (
              <Link
                href="/products/new"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                {t("products.addProduct")}
              </Link>
            )}
          </div>
        </div>

        <div className="-mx-4 sm:mx-0">
          {loading ? (
            <div className="p-6 text-center text-dark-6">{t("common.loading")}</div>
          ) : (
            <ResponsiveDataList<Product>
              items={visibleProducts}
              keyExtractor={(p) => p.id}
              emptyMessage={
                query ? (
                  t("products.noResults")
                ) : canWrite ? (
                  <>
                    {t("products.empty")}{" "}
                    <Link href="/products/new" className="text-primary hover:underline">
                      {t("products.emptyCta")}
                    </Link>
                  </>
                ) : (
                  t("products.empty")
                )
              }
              columns={[
                { key: "name", label: t("products.column.name"), render: (p) => p.name, prominent: true },
                { key: "brand", label: t("products.column.brand"), render: (p) => p.brand || "—" },
                {
                  key: "price",
                  label: t("products.column.price"),
                  render: (p) => <Price amount={p.unitPrice} currency={p.currency} />,
                  align: "right",
                },
                {
                  key: "stock",
                  label: t("products.column.stock"),
                  render: (p) => String(p.quantityInStock),
                  align: "right",
                },
                {
                  key: "lowStock",
                  label: t("products.column.lowStock"),
                  render: (p) => p.lowStockThreshold ?? "—",
                  align: "right",
                },
              ]}
              renderActions={
                canWrite
                  ? (p) => (
                      <>
                        <button
                          type="button"
                          onClick={() => openForecast(p)}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {t("products.action.restock")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="text-sm font-medium text-red hover:underline"
                        >
                          {t("products.action.delete")}
                        </button>
                      </>
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
                {t("products.forecast.title", { productName: forecastModal.productName })}
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
                {t("products.forecast.analysing")}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded bg-gray-50 p-3 dark:bg-dark-2">
                    <p className="text-xs text-gray-500">{t("products.forecast.currentStock")}</p>
                    <p className="text-lg font-bold">
                      {forecastModal.currentStock}
                    </p>
                  </div>
                  <div className="rounded bg-gray-50 p-3 dark:bg-dark-2">
                    <p className="text-xs text-gray-500">{t("products.forecast.avgDailySales")}</p>
                    <p className="text-lg font-bold">
                      {forecastModal.avgDailySales.toFixed(1)}
                    </p>
                  </div>
                  <div className="rounded bg-gray-50 p-3 dark:bg-dark-2">
                    <p className="text-xs text-gray-500">{t("products.forecast.daysUntilStockout")}</p>
                    <p className="text-lg font-bold">
                      {forecastModal.daysUntilStockout !== null
                        ? forecastModal.daysUntilStockout
                        : t("products.forecast.na")}
                    </p>
                  </div>
                  <div className="rounded bg-gray-50 p-3 dark:bg-dark-2">
                    <p className="text-xs text-gray-500">{t("products.forecast.predictedDate")}</p>
                    <p className="text-sm font-bold">
                      {forecastModal.predictedStockoutDate ??
                        t("products.forecast.insufficientData")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{t("products.forecast.confidence")}:</span>
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
                      {t("products.forecast.loanOffered")}
                    </p>
                    <p className="mt-1 text-sm text-green-700">
                      {t("products.forecast.reorder")}{" "}
                      <strong>
                        {forecastModal.loanOffer.suggestedReorderQuantity}
                      </strong>{" "}
                      {t("products.forecast.units")} —{" "}{t("products.forecast.loanAmount")}:{" "}
                      <strong>
                        <Price
                          amount={forecastModal.loanOffer.suggestedLoanAmount}
                          currency={forecastModal.loanOffer.currency}
                        />
                      </strong>
                    </p>
                    <p className="mt-1 text-xs text-green-600">
                      {t("products.forecast.status")}: {forecastModal.loanOffer.status}
                    </p>
                  </div>
                ) : forecastModal.avgDailySales > 0 ? (
                  <button
                    type="button"
                    onClick={handleRestockLoan}
                    className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {t("products.forecast.requestCredit")}
                  </button>
                ) : (
                  <p className="text-center text-xs text-gray-500">
                    {t("products.forecast.noHistory")}
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
