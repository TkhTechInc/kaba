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
import { standardFormat } from "@/lib/format-number";
import { createDebtsApi, type Debt, type DebtStatus } from "@/services/debts.service";
import { useEffect, useState } from "react";

const CURRENCIES = [
  { value: "NGN", label: "NGN" },
  { value: "GHS", label: "GHS" },
  { value: "XOF", label: "XOF" },
  { value: "XAF", label: "XAF" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

export default function DebtsPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | DebtStatus>("all");
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    debtorName: "",
    amount: "",
    currency: "NGN",
    dueDate: new Date().toISOString().slice(0, 10),
    phone: "",
    notes: "",
  });

  const api = createDebtsApi(token);
  const canRemind = features.isEnabled("debt_reminders");

  const load = () => {
    if (!businessId) return;
    setLoading(true);
    api
      .list(businessId, 1, 20, statusFilter === "all" ? undefined : statusFilter)
      .then((r) => {
        setDebts(r.data.items);
        setTotal(r.data.total);
        setPage(1);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [businessId, statusFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !form.debtorName.trim() || !form.amount || !form.dueDate) return;
    setSubmitting(true);
    setError(null);
    api
      .create({
        businessId,
        debtorName: form.debtorName.trim(),
        amount: Number(form.amount),
        currency: form.currency,
        dueDate: form.dueDate,
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
      .then(() => {
        setForm({ debtorName: "", amount: "", currency: form.currency, dueDate: new Date().toISOString().slice(0, 10), phone: "", notes: "" });
        load();
      })
      .catch((e) => setError(e.message))
      .finally(() => setSubmitting(false));
  };

  const handleMarkPaid = (id: string) => {
    if (!businessId) return;
    setSubmitting(true);
    api
      .markPaid(businessId, id)
      .then(() => load())
      .catch((e) => setError(e.message))
      .finally(() => setSubmitting(false));
  };

  const handleSendReminder = (id: string) => {
    if (!businessId) return;
    setRemindingId(id);
    setError(null);
    api
      .sendReminder(businessId, id)
      .then((r) => {
        if (r.data.sent) {
          setError(null);
        } else {
          setError("Failed to send reminder");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setRemindingId(null));
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="People who owe me" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to manage debts.</p>
        </div>
      </>
    );
  }

  if (!features.isEnabled("debt_tracker")) {
    return (
      <>
        <Breadcrumb pageName="People who owe me" />
        <UpgradePrompt feature="Debt tracker" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="People who owe me" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">Add debt</h3>
          <p className="mb-4 text-sm text-dark-6">
            Record when someone owes you money. Add their phone number to send reminders later.
          </p>
          {error && (
            <div className="mb-4 rounded bg-red/10 p-3 text-sm text-red">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <InputGroup
              label="Name"
              type="text"
              value={form.debtorName}
              handleChange={(e) => setForm((f) => ({ ...f, debtorName: e.target.value }))}
              placeholder="Person or business name"
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <InputGroup
                label="Amount"
                type="number"
                value={form.amount}
                handleChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                required
              />
              <div>
                <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="w-full rounded-lg border border-stroke px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <InputGroup
              label="Due date"
              type="date"
              value={form.dueDate}
              handleChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              placeholder=""
              required
            />
            <InputGroup
              label="Phone (for reminders)"
              type="text"
              value={form.phone}
              handleChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+234..."
            />
            <InputGroup
              label="Notes"
              type="text"
              value={form.notes}
              handleChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Adding…" : "Add debt"}
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">Outstanding debts</h3>
          <div className="mb-4 flex gap-2">
            {(["all", "pending", "overdue", "paid"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  statusFilter === s
                    ? "bg-primary text-white"
                    : "bg-gray-2 text-dark-6 hover:bg-gray-3 dark:bg-dark-2 dark:text-dark-5"
                }`}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : debts.length === 0 ? (
            <p className="py-8 text-center text-dark-6">No debts yet. Add one above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.debtorName}</TableCell>
                    <TableCell className="text-right">
                      {d.currency} {standardFormat(d.amount)}
                    </TableCell>
                    <TableCell>{d.dueDate}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                          d.status === "overdue"
                            ? "bg-red/20 text-red"
                            : d.status === "paid"
                            ? "bg-green/20 text-green"
                            : "bg-amber/20 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {d.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {d.status !== "paid" && (
                        <>
                          {canRemind && d.phone && (
                            <button
                              type="button"
                              onClick={() => handleSendReminder(d.id)}
                              disabled={remindingId === d.id}
                              className="mr-2 text-sm font-medium text-primary hover:underline disabled:opacity-50"
                            >
                              {remindingId === d.id ? "Sending…" : "Send reminder"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(d.id)}
                            disabled={submitting}
                            className="text-sm font-medium text-green hover:underline disabled:opacity-50"
                          >
                            Mark paid
                          </button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
