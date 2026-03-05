"use client";

import { useAuth } from "@/contexts/auth-context";
import { createAdminApi } from "@/services/admin.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";
import type {
  AdminUsageSummary,
  AdminUsageItem,
} from "@/services/admin.service";

const PAGE_SIZE = 20;

function getMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    options.push({ value, label });
  }
  return options;
}

const MONTH_OPTIONS = getMonthOptions();

export default function AdminUsagePage() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminUsageSummary | null>(null);
  const [items, setItems] = useState<AdminUsageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const load = (lastKey?: string, monthParam?: string) => {
    if (!token) return;
    const isInitial = !lastKey;
    if (isInitial) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    createAdminApi(token)
      .getUsageSummary({
        limit: PAGE_SIZE,
        lastEvaluatedKey: lastKey,
        month: monthParam ?? month,
      })
      .then((res) => {
        const payload = (res as { data?: AdminUsageSummary })?.data;
        if (!payload) throw new Error("Invalid response");
        if (isInitial) {
          setData(payload);
          setItems(payload.items ?? []);
        } else {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  items: [...(prev.items ?? []), ...(payload.items ?? [])],
                  lastEvaluatedKey: payload.lastEvaluatedKey,
                  month: payload.month,
                }
              : payload
          );
          setItems((prev) => [...prev, ...(payload.items ?? [])]);
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    load(undefined, month);
  }, [token, month]);

  const handleLoadMore = () => {
    if (!data?.lastEvaluatedKey || loadingMore) return;
    const keyStr = encodeURIComponent(JSON.stringify(data.lastEvaluatedKey));
    load(keyStr, month);
  };

  const formatCountLimit = (count: number, limit?: number) => {
    if (limit != null) {
      return `${count.toLocaleString()} / ${limit.toLocaleString()}`;
    }
    return count.toLocaleString();
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">
        Usage Dashboard
      </h1>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-dark-6 dark:text-dark-6">
            Month:
          </span>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {MONTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>AI Queries</TableHead>
              <TableHead>Mobile Money Recon</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.businessId}>
                <TableCell className="font-mono text-sm">
                  {row.businessId}
                </TableCell>
                <TableCell>{row.businessName ?? "-"}</TableCell>
                <TableCell>{row.tier ?? "-"}</TableCell>
                <TableCell>
                  {formatCountLimit(row.aiQueryCount, row.aiQueryLimit)}
                </TableCell>
                <TableCell>
                  {formatCountLimit(
                    row.mobileMoneyReconCount,
                    row.mobileMoneyReconLimit
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {items.length === 0 && !loading && (
          <p className="p-8 text-center text-dark-6 dark:text-dark-6">
            No usage data found for this month.
          </p>
        )}
        {data?.lastEvaluatedKey && (
          <div className="border-t p-4">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
