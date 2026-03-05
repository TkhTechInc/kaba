import { api } from "@/lib/api-client";

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

export function createProductsApi(token: string | null) {
  return {
    list: (businessId: string, page = 1, limit = 50) =>
      api.get<ListProductsResult>("/api/v1/products", {
        token: token ?? undefined,
        params: { businessId, page: String(page), limit: String(limit) },
      }),

    getById: (businessId: string, id: string) =>
      api.get<Product>("/api/v1/products/" + id, {
        token: token ?? undefined,
        params: { businessId },
      }),

    create: (body: CreateProductInput) =>
      api.post<Product>("/api/v1/products", body, { token: token ?? undefined }),

    update: (id: string, body: UpdateProductInput & { businessId: string }) =>
      api.patch<Product>(`/api/v1/products/${id}`, body, { token: token ?? undefined }),

    delete: (businessId: string, id: string) =>
      api.delete(`/api/v1/products/${id}?businessId=${encodeURIComponent(businessId)}`, {
        token: token ?? undefined,
      }),

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

    createRestockLoan: (businessId: string, productId: string) =>
      api.post<{
        id: string;
        productId: string;
        productName: string;
        predictedStockoutDate: string;
        suggestedLoanAmount: number;
        suggestedReorderQuantity: number;
        currency: string;
        status: string;
        createdAt: string;
      }>(`/api/v1/inventory/${productId}/restock-loan?businessId=${encodeURIComponent(businessId)}`, {}, {
        token: token ?? undefined,
      }),

    respondToRestockLoan: (businessId: string, offerId: string, decision: 'accepted' | 'rejected') =>
      api.patch<{ id: string; status: string }>(
        `/api/v1/inventory/loans/${offerId}`,
        { businessId, decision },
        { token: token ?? undefined }
      ),
  };
}
