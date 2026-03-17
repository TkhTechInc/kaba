"use client";

import { useRef, useEffect, useState, useId } from "react";
import type { Customer } from "@/services/invoices.service";

interface CustomerSelectProps {
  customers: Customer[];
  value: string;
  onChange: (customerId: string) => void;
  onAddCustomer?: (customer: Customer) => void;
  createCustomer: (body: {
    businessId: string;
    name: string;
    email: string;
    phone?: string;
  }) => Promise<unknown>;
  businessId: string;
  disabled?: boolean;
  placeholder?: string;
  /** Optional id for the main input; use with htmlFor on parent label for accessibility */
  id?: string;
}

export function CustomerSelect({
  customers,
  value,
  onChange,
  onAddCustomer,
  createCustomer,
  businessId,
  disabled,
  placeholder = "Search or select customer",
  id: idProp,
}: CustomerSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", phone: "" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const addNameId = useId();
  const addEmailId = useId();
  const addPhoneId = useId();

  const selected = customers.find((c) => c.id === value);
  const filtered =
    search.trim().length > 0
      ? customers.filter(
          (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
        )
      : customers;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = addForm.email.trim();
    if (!addForm.name.trim() || !email) {
      setAddError("Name and email are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAddError("Please enter a valid email address.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await createCustomer({
        businessId,
        name: addForm.name.trim(),
        email,
        phone: addForm.phone.trim() || undefined,
      });
      const created = (res as { data?: Customer }).data ?? (res as unknown as Customer);
      if (!created?.id) {
        setAddError("Customer was created but could not be selected. Please refresh and try again.");
        return;
      }
      onAddCustomer?.(created);
      onChange(created.id);
      setAddForm({ name: "", email: "", phone: "" });
      setShowAddForm(false);
      setOpen(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add customer");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          {!idProp && (
            <label htmlFor={inputId} className="sr-only">
              {placeholder}
            </label>
          )}
          <input
            id={inputId}
            name="customerId"
            type="text"
            value={open ? search : selected?.name ?? ""}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full rounded-lg border border-stroke bg-transparent px-5.5 py-3 pr-8 dark:border-dark-3 dark:bg-dark-2"
            autoComplete="off"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dark-6">
            ▼
          </span>
        </div>
        {onAddCustomer && (
          <button
            type="button"
            onClick={() => {
              setShowAddForm(true);
              setOpen(false);
            }}
            className="shrink-0 rounded-lg border border-dashed border-stroke px-3 py-2 text-sm text-dark-4 hover:border-primary hover:text-primary dark:border-dark-3 dark:text-dark-6 dark:hover:border-primary dark:hover:text-primary"
          >
            + Add new
          </button>
        )}
      </div>

      {open && !showAddForm && (
        <ul
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-stroke bg-white shadow-lg dark:border-dark-3 dark:bg-gray-dark"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-dark-6">
              {search ? "No matches. Add a new customer?" : "No customers yet."}
            </li>
          ) : (
            filtered.slice(0, 50).map((c) => (
              <li
                key={c.id}
                role="option"
                aria-selected={value === c.id}
                onClick={() => {
                  onChange(c.id);
                  setSearch("");
                  setOpen(false);
                }}
                className={`cursor-pointer px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-2 ${
                  value === c.id ? "bg-primary/10 text-primary" : ""
                }`}
              >
                {c.name}
                {c.email ? ` (${c.email})` : ""}
              </li>
            ))
          )}
          {filtered.length > 50 && (
            <li className="border-t border-stroke px-4 py-2 text-xs text-dark-6 dark:border-dark-3">
              Type to narrow down. Showing first 50.
            </li>
          )}
        </ul>
      )}

      {showAddForm && (
        <div className="mt-3 rounded-lg border border-stroke bg-gray-50 p-4 dark:border-dark-3 dark:bg-dark-2">
          <p className="mb-3 text-sm font-medium">Add new customer</p>
          <form onSubmit={handleAddSubmit} className="space-y-2">
            {addError && (
              <div className="rounded bg-red/10 p-2 text-sm text-red">
                {addError}
              </div>
            )}
            <label htmlFor={addNameId} className="sr-only">Name</label>
            <input
              id={addNameId}
              name="name"
              type="text"
              placeholder="Name"
              required
              value={addForm.name}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, name: e.target.value }))
              }
              className="w-full rounded border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2"
            />
            <label htmlFor={addEmailId} className="sr-only">Email</label>
            <input
              id={addEmailId}
              name="email"
              type="email"
              placeholder="Email"
              required
              value={addForm.email}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, email: e.target.value }))
              }
              className="w-full rounded border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2"
            />
            <label htmlFor={addPhoneId} className="sr-only">Phone (optional)</label>
            <input
              id={addPhoneId}
              name="phone"
              type="tel"
              placeholder="Phone (optional)"
              value={addForm.phone}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, phone: e.target.value }))
              }
              className="w-full rounded border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={adding}
                className="rounded bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {adding ? "Adding…" : "Add & select"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setAddForm({ name: "", email: "", phone: "" });
                  setAddError(null);
                }}
                className="rounded border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
