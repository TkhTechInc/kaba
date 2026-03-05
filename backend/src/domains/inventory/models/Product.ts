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
