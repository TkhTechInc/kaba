export interface Customer {
  id: string;
  businessId: string;
  name: string;
  email: string;
  phone?: string;
  createdAt?: string;
}

export interface CreateCustomerInput {
  businessId: string;
  name: string;
  email: string;
  phone?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string;
  phone?: string;
}
