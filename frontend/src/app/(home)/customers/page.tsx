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
import { getPhonePlaceholder } from "@/lib/country-dial-codes";
import {
  createInvoicesApi,
  type Customer,
} from "@/services/invoices.service";
import { createReportsApi } from "@/services/reports.service";
import { useEffect, useState } from "react";

type CreditScoreData = {
  trustScore: number;
  recommendation: 'approve' | 'review' | 'deny';
  breakdown: {
    transactionFrequency: number;
    debtRepaymentRatio: number;
    volumeConsistency: number;
  };
};

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
  const [creditModal, setCreditModal] = useState<{ customerId: string; name: string } | null>(null);
  const [creditScore, setCreditScore] = useState<CreditScoreData | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);

  const api = createInvoicesApi(token);
  const reportsApi = createReportsApi(token);

  const openCreditScore = async (customer: Customer) => {
    if (!businessId) return;
    setCreditModal({ customerId: customer.id, name: customer.name });
    setCreditScore(null);
    setCreditError(null);
    setCreditLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
      const r = await reportsApi.getCreditScore(businessId, customer.id, sixMonthsAgo, today);
      setCreditScore(r.data);
    } catch (e: unknown) {
      setCreditError(e instanceof Error ? e.message : "Failed to load credit score");
    } finally {
      setCreditLoading(false);
    }
  };

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
                      <TableHead scope="col">Trust Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
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
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => openCreditScore(c)}
                              className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                            >
                              View Score
                            </button>
                          </TableCell>
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
                placeholder={getPhonePlaceholder(features.countryCode)}
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

      {/* Credit Score Modal */}
      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-dark dark:text-white">
                Trust Score — {creditModal.name}
              </h3>
              <button
                onClick={() => { setCreditModal(null); setCreditScore(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {creditLoading && (
              <p className="py-8 text-center text-gray-500">Calculating score…</p>
            )}
            {creditError && (
              <p className="text-sm text-red-600">{creditError}</p>
            )}
            {creditScore && (
              <div className="space-y-4">
                {/* Score dial */}
                <div className="flex flex-col items-center py-4">
                  <div
                    className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white ${
                      creditScore.trustScore >= 70
                        ? "bg-green-500"
                        : creditScore.trustScore >= 40
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  >
                    {creditScore.trustScore}
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-600">Trust Score / 100</p>
                  <span
                    className={`mt-1 rounded-full px-3 py-0.5 text-sm font-semibold capitalize ${
                      creditScore.recommendation === "approve"
                        ? "bg-green-100 text-green-800"
                        : creditScore.recommendation === "review"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {creditScore.recommendation === "approve"
                      ? "✓ Approve Credit"
                      : creditScore.recommendation === "review"
                      ? "⚠ Review Manually"
                      : "✗ Deny Credit"}
                  </span>
                </div>

                {/* Breakdown */}
                <div className="space-y-2 border-t pt-4">
                  {[
                    { label: "Transaction Frequency", value: creditScore.breakdown.transactionFrequency },
                    { label: "Debt Repayment Ratio", value: creditScore.breakdown.debtRepaymentRatio },
                    { label: "Volume Consistency", value: creditScore.breakdown.volumeConsistency },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="mb-1 flex justify-between text-xs text-gray-600">
                        <span>{label}</span>
                        <span>{value}/100</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
