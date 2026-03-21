"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Price } from "@/components/ui/Price";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { ApiError } from "@/lib/api-client";
import {
  createPayrollApi,
  type Employee,
  type CreateEmployeeInput,
} from "@/services/payroll.service";
import { getCurrencyForCountry } from "@/lib/country-currency";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function PayrollEmployeesPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateEmployeeInput>(() => ({
    name: "",
    grossSalary: 0,
    currency: features.currency ?? getCurrencyForCountry(features.countryCode ?? "BJ"),
    countryCode: features.countryCode ?? "BJ",
    employmentStartDate: new Date().toISOString().slice(0, 10),
  }));

  const api = createPayrollApi(token);
  const payrollEnabled = features.isEnabled("payroll");

  const load = () => {
    if (!businessId) return;
    setLoading(true);
    api
      .listEmployees(businessId)
      .then((r) => setEmployees(r.data ?? []))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [businessId]);

  const handleCreate = () => {
    if (!businessId || !form.name.trim() || form.grossSalary < 0) return;
    setSubmitting(true);
    setError(null);
    api
      .createEmployee(businessId, form)
      .then(() => {
        setShowForm(false);
        setForm({
          name: "",
          grossSalary: 0,
          currency: form.currency,
          countryCode: form.countryCode,
          employmentStartDate: new Date().toISOString().slice(0, 10),
        });
        load();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Create failed"))
      .finally(() => setSubmitting(false));
  };

  if (!payrollEnabled) {
    return (
      <div>
        <Breadcrumb pageName="Payroll - Employees" />
        <UpgradePrompt feature="Payroll" />
      </div>
    );
  }

  if (forbidden) return <PermissionDenied />;

  return (
    <div>
      <Breadcrumb pageName="Payroll - Employees" />
      <div className="rounded-lg border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Employees</h2>
          <div className="flex gap-2">
            <Link
              href="/payroll"
              className="rounded border border-stroke px-4 py-2 text-sm hover:bg-gray-50 dark:border-strokedark dark:hover:bg-boxdark-2"
            >
              Back
            </Link>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90"
            >
              + Add Employee
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mb-6 rounded border border-stroke p-4 dark:border-strokedark">
            <h3 className="mb-3 text-sm font-medium">New Employee</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded border border-stroke px-3 py-2 dark:border-strokedark dark:bg-boxdark-2"
              />
              <input
                type="number"
                placeholder="Gross salary"
                value={form.grossSalary || ""}
                onChange={(e) => setForm((f) => ({ ...f, grossSalary: parseFloat(e.target.value) || 0 }))}
                className="rounded border border-stroke px-3 py-2 dark:border-strokedark dark:bg-boxdark-2"
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value || undefined }))}
                className="rounded border border-stroke px-3 py-2 dark:border-strokedark dark:bg-boxdark-2"
              />
              <input
                type="tel"
                placeholder="MoMo phone"
                value={form.momoPhone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, momoPhone: e.target.value || undefined }))}
                className="rounded border border-stroke px-3 py-2 dark:border-strokedark dark:bg-boxdark-2"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleCreate}
                disabled={submitting || !form.name.trim()}
                className="rounded bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-2">
            {employees.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded border border-stroke px-4 py-3 dark:border-strokedark"
              >
                <div>
                  <p className="font-medium">{e.name}</p>
                  <p className="text-sm text-gray-500">
                    {e.email ?? e.momoPhone ?? e.phone ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Price amount={e.grossSalary} currency={e.currency} />
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      e.status === "active"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 dark:bg-gray-800"
                    }`}
                  >
                    {e.status}
                  </span>
                </div>
              </div>
            ))}
            {employees.length === 0 && !showForm && (
              <p className="py-8 text-center text-sm text-gray-500">
                No employees yet. Add one to run payroll.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
