"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import InputGroup from "@/components/FormElements/InputGroup";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import {
  createInvoicesApi,
  type Customer,
} from "@/services/invoices.service";
import { useEffect, useState } from "react";

export default function CustomersPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const api = createInvoicesApi(token);

  const load = () => {
    if (!businessId) return;
    setLoading(true);
    api
      .listCustomers(businessId, page, 20)
      .then((r) => {
        setCustomers(r.data.items);
        setTotal(r.data.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [businessId, page]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !form.name.trim()) return;
    const email = form.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError(null);
    api
      .createCustomer({
        businessId,
        name: form.name.trim(),
        email,
        phone: form.phone.trim() || undefined,
      })
      .then((r) => {
        const res = r as { success?: boolean; data?: Customer };
        const created = res?.data ?? (r as unknown as Customer);
        if (created?.id) {
          setCustomers((prev) => [created, ...prev]);
          setTotal((t) => t + 1);
          setForm({ name: "", email: "", phone: "" });
        } else {
          load();
        }
      })
      .catch((e) => setError(e?.message ?? "Failed to add customer"))
      .finally(() => setSubmitting(false));
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="Customers" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to manage customers.</p>
        </div>
      </>
    );
  }

  if (!features.isEnabled("invoicing")) {
    return (
      <>
        <Breadcrumb pageName="Customers" />
        <UpgradePrompt feature="Invoicing" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Customers" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
            <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
              <h3 className="font-semibold text-dark dark:text-white">
                Customers
              </h3>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-6 text-center text-dark-6">Loading...</div>
              ) : (
                <Table role="table" aria-label="Customers">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Name</TableHead>
                      <TableHead scope="col">Email</TableHead>
                      <TableHead scope="col">Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-dark-6"
                        >
                          No customers yet. Add one to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      customers.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{c.email ?? "—"}</TableCell>
                          <TableCell>{c.phone ?? "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
            {total > 20 && (
              <div className="flex justify-center gap-2 border-t border-stroke p-4 dark:border-dark-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="py-1 text-sm">
                  Page {page} of {Math.ceil(total / 20)}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(total / 20)}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
            <h3 className="mb-4 font-semibold text-dark dark:text-white">
              Add customer
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded bg-red/10 p-3 text-sm text-red">
                  {error}
                </div>
              )}
              <InputGroup
                label="Name"
                type="text"
                placeholder="Customer name"
                required
                value={form.name}
                handleChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              <InputGroup
                label="Email"
                type="email"
                placeholder="Email address"
                required
                value={form.email}
                handleChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
              <InputGroup
                label="Phone"
                type="tel"
                placeholder="Phone (optional)"
                value={form.phone}
                handleChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-primary py-2 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Adding…" : "Add customer"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
