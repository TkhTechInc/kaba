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
  type PayRun,
} from "@/services/payroll.service";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function PayrollPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payRuns, setPayRuns] = useState<PayRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const api = createPayrollApi(token);
  const payrollEnabled = features.isEnabled("payroll");

  const load = () => {
    if (!businessId) return;
    setError(null);
    setLoading(true);
    Promise.all([
      api.listEmployees(businessId),
      api.listPayRuns(businessId),
    ])
      .then(([empRes, payRes]) => {
        setEmployees(empRes.data ?? []);
        setPayRuns(payRes.data ?? []);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : "Failed to load payroll");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [businessId]);

  if (!payrollEnabled) {
    return (
      <div>
        <Breadcrumb pageName="Payroll" />
        <UpgradePrompt feature="Payroll" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <Breadcrumb pageName="Payroll" />
        <PermissionDenied />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb pageName="Payroll" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Employees</h2>
            <Link
              href="/payroll/employees"
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90"
            >
              Manage
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <p className="text-sm">
              {employees.filter((e) => e.status === "active").length} active
              employees
            </p>
          )}
        </div>
        <div className="rounded-lg border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pay Runs</h2>
            <Link
              href="/payroll/pay-runs"
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90"
            >
              Run Payroll
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <div className="space-y-2">
              {payRuns.slice(0, 5).map((pr) => (
                <div
                  key={pr.id}
                  className="flex items-center justify-between rounded border border-stroke px-3 py-2 dark:border-strokedark"
                >
                  <span className="text-sm font-medium">{pr.periodMonth}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      pr.status === "paid"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : pr.status === "finalized"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {pr.status}
                  </span>
                  <Price amount={pr.totalNet} currency={pr.currency} />
                </div>
              ))}
              {payRuns.length === 0 && (
                <p className="text-sm text-gray-500">No pay runs yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
