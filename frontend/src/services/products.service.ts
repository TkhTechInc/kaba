import {
  api,
  apiGetWithOfflineCache,
} from "@/lib/api-client";
import { CACHE_KEYS, listCacheKey, getCached, setCached } from "@/lib/offline-cache";
import type { ApiResponse } from "@/lib/api-client";
import { offlineMutation } from "@/lib/offline-api";

export interface Product {
  id: string;
  businessId: string;
  name: string;
  brand?: string;
  unitPrice: number;
  currency: string;
  quantityInStock: number;
  lowStockThreshold?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  businessId: string;
  name: string;
  brand?: string;
  unitPrice: number;
  currency: string;
  quantityInStock: number;
  lowStockThreshold?: number;
}

export interface UpdateProductInput {
  name?: string;
  brand?: string;
  unitPrice?: number;
  currency?: string;
  quantityInStock?: number;
  lowStockThreshold?: number;
}

export interface ListProductsResult {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

async function patchProductsCache(
  businessId: string,
  updater: (
    cached: ApiResponse<ListProductsResult>
  ) => { items: Product[]; total: number }
) {
  const cacheKey = listCacheKey(CACHE_KEYS.PRODUCTS, businessId, {
    businessId,
    page: "1",
    limit: "50",
  });
  try {
    const cached = await getCached<ApiResponse<ListProductsResult>>(cacheKey);
    if (cached?.data) {
      const { items, total } = updater(cached);
      await setCached(cacheKey, {
        ...cached,
        data: { ...cached.data, items, total },
      });
    }
  } catch {
    /* best-effort */
  }
}

export function createProductsApi(token: string | null) {
  return {
    list: (businessId: string, page = 1, limit = 50) => {
      const params = {
        businessId,
        page: String(page),
        limit: String(limit),
      };
      return apiGetWithOfflineCache<ListProductsResult>(
        "/api/v1/products",
        listCacheKey(CACHE_KEYS.PRODUCTS, businessId, params),
        { token: token ?? undefined, params }
      );
    },

    getById: (businessId: string, id: string) =>
      api.get<Product>("/api/v1/products/" + id, {
        token: token ?? undefined,
        params: { businessId },
      }),

    create: async (body: CreateProductInput) => {
      const optimistic: Product = {
        id: "pending-" + Date.now(),
        businessId: body.businessId,
        name: body.name,
        brand: body.brand,
        unitPrice: body.unitPrice,
        currency: body.currency,
        quantityInStock: body.quantityInStock,
        lowStockThreshold: body.lowStockThreshold,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = await offlineMutation<Product>(
        "/api/v1/products",
        "POST",
        body,
        token,
        optimistic
      );
      const product = result.data;
      if (product?.id) {
        await patchProductsCache(body.businessId, (cached) => ({
          items: [product, ...cached.data.items],
          total: cached.data.total + 1,
        }));
      }
      return result;
    },

    update: async (id: string, body: UpdateProductInput & { businessId: string }) => {
      const { businessId, ...updates } = body;
      const optimistic: Product = {
        id,
        businessId,
        name: updates.name ?? "",
        unitPrice: updates.unitPrice ?? 0,
        currency: updates.currency ?? "",
        quantityInStock: updates.quantityInStock ?? 0,
        brand: updates.brand,
        lowStockThreshold: updates.lowStockThreshold,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = await offlineMutation<Product>(
        `/api/v1/products/${id}`,
        "PATCH",
        body,
        token,
        optimistic
      );
      const product = result.data;
      if (product?.id) {
        await patchProductsCache(businessId, (cached) => ({
          items: cached.data.items.map((p) => (p.id === id ? product : p)),
          total: cached.data.total,
        }));
      }
      return result.data;
    },

    delete: async (businessId: string, id: string) => {
      const result = await offlineMutation<{ deleted: boolean; id: string }>(
        `/api/v1/products/${id}?businessId=${encodeURIComponent(businessId)}`,
        "DELETE",
        {},
        token,
        { deleted: true, id }
      );
      if (result.data?.id) {
        await patchProductsCache(businessId, (cached) => ({
          items: cached.data.items.filter((p) => p.id !== id),
          total: Math.max(0, cached.data.total - 1),
        }));
      }
      return result.data;
    },

    getStockoutForecast: (businessId: string, productId: string) =>
      api.get<{
        productId: string;
        productName: string;
        currentStock: number;
        avgDailySales: number;
        daysUntilStockout: number | null;
        predictedStockoutDate: string | null;
        confidence: 'high' | 'medium' | 'low';
      }>(`/api/v1/inventory/${productId}/stockout-forecast`, {
        token: token ?? undefined,
        params: { businessId },
      }),

    createRestockLoan: async (businessId: string, productId: string) => {
      const optimistic = {
        id: "pending-" + Date.now(),
        productId,
        productName: "",
        predictedStockoutDate: new Date().toISOString(),
        suggestedLoanAmount: 0,
        suggestedReorderQuantity: 0,
        currency: "",
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      const result = await offlineMutation<{
        id: string;
        productId: string;
        productName: string;
        predictedStockoutDate: string;
        suggestedLoanAmount: number;
        suggestedReorderQuantity: number;
        currency: string;
        status: string;
        createdAt: string;
      }>(
        `/api/v1/inventory/${productId}/restock-loan?businessId=${encodeURIComponent(businessId)}`,
        "POST",
        {},
        token,
        optimistic
      );
      return result.data;
    },

    respondToRestockLoan: async (businessId: string, offerId: string, decision: 'accepted' | 'rejected') => {
      const result = await offlineMutation<{ id: string; status: string }>(
        `/api/v1/inventory/loans/${offerId}`,
        "PATCH",
        { businessId, decision },
        token,
        { id: offerId, status: decision }
      );
      return result.data;
    },
  };
}
