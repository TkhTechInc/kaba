"use client";

import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { createAdminApi } from "@/services/admin.service";
import { useEffect, useState } from "react";
import type { AdminHealth } from "@/services/admin.service";

export default function AdminHealthPage() {
  const { t } = useLocale();
  const { token } = useAuth();
  const [data, setData] = useState<AdminHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    createAdminApi(token)
      .getHealth()
      .then(
        (res) =>
          (res as { data?: AdminHealth })?.data ?? (res as unknown as AdminHealth)
      )
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

  const statusColor =
    data?.status === "ok"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">
        {t("admin.health.title")}
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <p className="text-sm font-medium text-dark-6 dark:text-dark-6">
            {t("admin.health.status")}
          </p>
          <span
            className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium capitalize ${statusColor}`}
          >
            {data?.status ?? "—"}
          </span>
        </div>
        <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:col-span-2">
          <p className="text-sm font-medium text-dark-6 dark:text-dark-6">
            {t("admin.health.lastChecked")}
          </p>
          <p className="mt-2 text-lg font-medium text-dark dark:text-white">
            {data?.timestamp ? formatTimestamp(data.timestamp) : "—"}
          </p>
        </div>
        <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <p className="text-sm font-medium text-dark-6 dark:text-dark-6">
            {t("admin.health.dynamodb")}
          </p>
          <p className="mt-2 text-lg font-medium text-dark dark:text-white">
            {data?.dynamodb?.ok ? (
              <span className="text-green-600 dark:text-green-400">{t("admin.health.ok")}</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">{t("admin.health.degraded")}</span>
            )}
          </p>
          {data?.dynamodb?.latencyMs != null && (
            <p className="mt-1 text-sm text-dark-6 dark:text-dark-6">
              {data.dynamodb.latencyMs} ms
            </p>
          )}
        </div>
        {data?.s3?.configured && (
          <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
            <p className="text-sm font-medium text-dark-6 dark:text-dark-6">
              {t("admin.health.s3")}
            </p>
            <p className="mt-2 text-lg font-medium text-dark dark:text-white">
              {data.s3.ok === true ? (
                <span className="text-green-600 dark:text-green-400">{t("admin.health.ok")}</span>
              ) : data.s3.ok === false ? (
                <span className="text-red-600 dark:text-red-400">{t("admin.health.degraded")}</span>
              ) : (
                <span className="text-dark-6 dark:text-dark-6">—</span>
              )}
            </p>
            {data.s3.latencyMs != null && (
              <p className="mt-1 text-sm text-dark-6 dark:text-dark-6">
                {data.s3.latencyMs} ms
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
