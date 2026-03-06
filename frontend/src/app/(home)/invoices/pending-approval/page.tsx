"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { useAuth } from "@/contexts/auth-context";
import { createInvoicesApi, type Invoice } from "@/services/invoices.service";
import { Price } from "@/components/ui/Price";
import { useEffect, useState } from "react";

export default function PendingApprovalsPage() {
  const { token, businessId } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const api = createInvoicesApi(token);

  const load = () => {
    if (!businessId) return;
    setLoading(true);
    api
      .listPendingApproval(businessId)
      .then((r) => setInvoices(r.data.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [businessId]);

  const handleApprove = async (invoiceId: string) => {
    if (!businessId) return;
    setApprovingId(invoiceId);
    try {
      await api.approveInvoice(invoiceId, businessId);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <Breadcrumb pageName="Pending Approvals" />

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-dark dark:text-white">
            Invoices Pending Manager Approval
          </h2>
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
            {invoices.length} pending
          </span>
        </div>

        {loading ? (
          <p className="py-8 text-center text-gray-500">Loading...</p>
        ) : (
          <ResponsiveDataList<Invoice>
            items={invoices}
            keyExtractor={(inv) => inv.id}
            emptyMessage="No invoices pending approval."
            columns={[
              { key: "id", label: "Invoice ID", render: (inv) => <span className="font-mono text-xs">{inv.id.slice(0, 8)}…</span>, prominent: true },
              { key: "customer", label: "Customer", render: (inv) => inv.customerId },
              { key: "amount", label: "Amount", render: (inv) => <Price amount={inv.amount} currency={inv.currency} /> },
              { key: "dueDate", label: "Due Date", render: (inv) => inv.dueDate },
              { key: "created", label: "Created", render: (inv) => inv.createdAt.slice(0, 10) },
            ]}
            renderActions={(inv) => (
              <button
                onClick={() => handleApprove(inv.id)}
                disabled={approvingId === inv.id}
                className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {approvingId === inv.id ? "Approving…" : "Approve"}
              </button>
            )}
          />
        )}
      </div>
    </div>
  );
}
