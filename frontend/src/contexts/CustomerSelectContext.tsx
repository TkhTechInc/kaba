"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  updatedAt: string;
}

interface CustomerSelectContextValue {
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  search: string;
  setSearch: (search: string) => void;
  selectedCustomer: Customer | null;
  selectCustomer: (customer: Customer | null) => void;
}

const CustomerSelectContext = createContext<CustomerSelectContextValue | undefined>(undefined);

export function CustomerSelectProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  return (
    <CustomerSelectContext.Provider
      value={{
        customers,
        setCustomers,
        loading,
        setLoading,
        search,
        setSearch,
        selectedCustomer,
        selectCustomer: setSelectedCustomer,
      }}
    >
      {children}
    </CustomerSelectContext.Provider>
  );
}

export function useCustomerSelect() {
  const context = useContext(CustomerSelectContext);
  if (!context) {
    throw new Error("useCustomerSelect must be used within CustomerSelectProvider");
  }
  return context;
}
