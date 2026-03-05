"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { createInvoicesApi, type Invoice } from "@/services/invoices.service";
import { standardFormat } from "@/lib/format-number";
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
        ) : invoices.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            No invoices pending approval. 
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.id.slice(0, 8)}…</TableCell>
                  <TableCell>{inv.customerId}</TableCell>
                  <TableCell>
                    {inv.currency} {standardFormat(inv.amount)}
                  </TableCell>
                  <TableCell>{inv.dueDate}</TableCell>
                  <TableCell>{inv.createdAt.slice(0, 10)}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleApprove(inv.id)}
                      disabled={approvingId === inv.id}
                      className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {approvingId === inv.id ? "Approving…" : "Approve"}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
