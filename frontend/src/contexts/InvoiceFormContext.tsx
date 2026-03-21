"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
}

interface InvoiceFormContextValue {
  lineItems: LineItem[];
  addLineItem: (item: LineItem) => void;
  removeLineItem: (id: string) => void;
  updateLineItem: (id: string, updates: Partial<LineItem>) => void;
  customer: Customer | null;
  setCustomer: (customer: Customer | null) => void;
  dueDate: string;
  setDueDate: (date: string) => void;
  notes: string;
  setNotes: (notes: string) => void;
}

const InvoiceFormContext = createContext<InvoiceFormContextValue | undefined>(undefined);

export function InvoiceFormProvider({ children }: { children: ReactNode }) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const addLineItem = (item: LineItem) => {
    setLineItems((prev) => [...prev, item]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  return (
    <InvoiceFormContext.Provider
      value={{
        lineItems,
        addLineItem,
        removeLineItem,
        updateLineItem,
        customer,
        setCustomer,
        dueDate,
        setDueDate,
        notes,
        setNotes,
      }}
    >
      {children}
    </InvoiceFormContext.Provider>
  );
}

export function useInvoiceForm() {
  const context = useContext(InvoiceFormContext);
  if (!context) {
    throw new Error("useInvoiceForm must be used within InvoiceFormProvider");
  }
  return context;
}
