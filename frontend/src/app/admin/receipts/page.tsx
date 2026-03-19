"use client";

import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { createAdminApi } from "@/services/admin.service";
import type { AdminReceiptsStatus } from "@/services/admin.service";
import { useEffect, useState } from "react";

export default function AdminReceiptsPage() {
  const { t } = useLocale();
  const { token } = useAuth();
  const [data, setData] = useState<AdminReceiptsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    createAdminApi(token)
      .getReceiptsStatus()
      .then(
        (res) =>
          (res as { data?: AdminReceiptsStatus })?.data ??
          (res as unknown as AdminReceiptsStatus)
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
      : data?.status === "unavailable"
        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">
        {t("admin.receipts.title")}
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <p className="text-sm font-medium text-dark-6 dark:text-dark-6">
            {t("admin.receipts.configured")}
          </p>
          <p className="mt-2 text-lg font-medium text-dark dark:text-white">
            {data?.configured ? t("admin.features.yes") : t("admin.features.no")}
          </p>
        </div>
        {data?.bucket && (
          <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
            <p className="text-sm font-medium text-dark-6 dark:text-dark-6">
              {t("admin.receipts.bucket")}
            </p>
            <p className="mt-2 text-lg font-medium text-dark dark:text-white">
              {data.bucket}
            </p>
          </div>
        )}
        {data?.region && (
          <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
            <p className="text-sm font-medium text-dark-6 dark:text-dark-6">
              {t("admin.receipts.region")}
            </p>
            <p className="mt-2 text-lg font-medium text-dark dark:text-white">
              {data.region}
            </p>
          </div>
        )}
        {data?.status != null && (
          <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
            <p className="text-sm font-medium text-dark-6 dark:text-dark-6">
              {t("admin.receipts.status")}
            </p>
            <span
              className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium capitalize ${statusColor}`}
            >
              {data.status}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
