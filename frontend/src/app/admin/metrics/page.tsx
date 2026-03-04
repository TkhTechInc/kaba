"use client";

import { useAuth } from "@/contexts/auth-context";
import { createAdminApi } from "@/services/admin.service";
import { useEffect, useState } from "react";
import type { AdminMetrics } from "@/services/admin.service";

export default function AdminMetricsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    createAdminApi(token)
      .getMetrics()
      .then((res) => (res as { data?: AdminMetrics })?.data ?? (res as unknown as AdminMetrics))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
        {error}
      </div>
    );
  }

  const metrics = [
    { label: "Businesses", value: data?.businessesCount ?? 0 },
    { label: "Ledger Entries", value: data?.ledgerEntriesCount ?? 0 },
    { label: "Invoices", value: data?.invoicesCount ?? 0 },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">
        Metrics
      </h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card"
          >
            <p className="text-sm font-medium text-dark-6 dark:text-dark-6">
              {m.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-dark dark:text-white">
              {m.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
      {data?.note && (
        <p className="mt-4 text-sm text-dark-6 dark:text-dark-6">{data.note}</p>
      )}
    </div>
  );
}
