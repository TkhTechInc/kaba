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
  AdminDebtsSummary,
  AdminDebtItem,
} from "@/services/admin.service";

const PAGE_SIZE = 20;

export default function AdminDebtsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminDebtsSummary | null>(null);
  const [items, setItems] = useState<AdminDebtItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = (lastKey?: string) => {
    if (!token) return;
    const isInitial = !lastKey;
    if (isInitial) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    createAdminApi(token)
      .getDebtsSummary({
        limit: PAGE_SIZE,
        lastEvaluatedKey: lastKey,
      })
      .then((res) => {
        const payload = (res as { data?: AdminDebtsSummary })?.data;
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
                  platformTotalCount:
                    (prev.platformTotalCount ?? 0) +
                    (payload.platformTotalCount ?? 0),
                  platformTotalAmount:
                    (prev.platformTotalAmount ?? 0) +
                    (payload.platformTotalAmount ?? 0),
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
    load();
  }, [token]);

  const handleLoadMore = () => {
    if (!data?.lastEvaluatedKey || loadingMore) return;
    const keyStr = encodeURIComponent(JSON.stringify(data.lastEvaluatedKey));
    load(keyStr);
  };

  const getBucketByLabel = (buckets: AdminDebtItem["buckets"], label: string) =>
    buckets?.find((b) => b.label === label);

  const BUCKET_LABELS = ["0-30 days", "31-60 days", "61-90 days", "90+ days"];

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
        Debts Summary
      </h1>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      {data && (
        <div className="mb-6 flex flex-wrap gap-4 rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <div>
            <p className="text-sm font-medium text-dark-6 dark:text-dark-6">
              Platform Total Count
            </p>
            <p className="text-xl font-bold text-dark dark:text-white">
              {data.platformTotalCount?.toLocaleString() ?? 0}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-dark-6 dark:text-dark-6">
              Platform Total Amount
            </p>
            <p className="text-xl font-bold text-dark dark:text-white">
              {data.platformTotalAmount?.toLocaleString() ?? 0}
            </p>
          </div>
        </div>
      )}
      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Debt Count</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>0-30 days</TableHead>
              <TableHead>31-60 days</TableHead>
              <TableHead>61-90 days</TableHead>
              <TableHead>90+ days</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.businessId}>
                <TableCell className="font-mono text-sm">
                  {row.businessId}
                </TableCell>
                <TableCell>{row.businessName ?? "-"}</TableCell>
                <TableCell>{row.totalCount?.toLocaleString() ?? 0}</TableCell>
                <TableCell>
                  {row.totalAmount?.toLocaleString() ?? 0}
                </TableCell>
                <TableCell>{row.currency ?? "-"}</TableCell>
                {BUCKET_LABELS.map((label) => {
                  const b = getBucketByLabel(row.buckets, label);
                  return (
                    <TableCell
                      key={label}
                      className="text-dark-6 dark:text-dark-6"
                    >
                      {b
                        ? `${row.currency} ${b.amount?.toLocaleString()} (${b.count})`
                        : "-"}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {items.length === 0 && !loading && (
          <p className="p-8 text-center text-dark-6 dark:text-dark-6">
            No debts found.
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
