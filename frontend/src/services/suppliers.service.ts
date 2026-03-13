import { api } from "@/lib/api-client";

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  phone?: string;
  momoPhone?: string;
  bankAccount?: string;
  currency: string;
  countryCode: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierInput {
  name: string;
  phone?: string;
  momoPhone?: string;
  bankAccount?: string;
  currency: string;
  countryCode: string;
  notes?: string;
}

export interface PaySupplierInput {
  amount: number;
  currency: string;
  description?: string;
}

export function createSuppliersApi(token: string | null) {
  const opts = { token: token ?? undefined };

  return {
    list: (businessId: string) =>
      api.get<{ items: Supplier[] }>(`/api/v1/suppliers?businessId=${encodeURIComponent(businessId)}`, opts),

    create: (businessId: string, data: CreateSupplierInput) =>
      api.post<Supplier>(`/api/v1/suppliers?businessId=${encodeURIComponent(businessId)}`, data, opts),

    update: (businessId: string, id: string, data: Partial<CreateSupplierInput>) =>
      api.put<Supplier>(`/api/v1/suppliers/${id}?businessId=${encodeURIComponent(businessId)}`, data, opts),

    deleteSupplier: (businessId: string, id: string) =>
      api.delete<void>(`/api/v1/suppliers/${id}?businessId=${encodeURIComponent(businessId)}`, opts),

    paySupplier: (businessId: string, id: string, data: PaySupplierInput) =>
      api.post<{ success: boolean; ledgerEntryId: string }>(
        `/api/v1/suppliers/${id}/pay?businessId=${encodeURIComponent(businessId)}`,
        data,
        opts
      ),
  };
}
