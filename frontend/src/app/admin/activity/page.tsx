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
import type { AdminActivity, AdminActivityItem } from "@/services/admin.service";

export default function AdminActivityPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageKey, setPageKey] = useState<string | null>(null);

  const load = (lastKey?: string) => {
    if (!token) return;
    setLoading(true);
    createAdminApi(token)
      .getActivity(lastKey ? { limit: 50, lastEvaluatedKey: lastKey } : { limit: 50 })
      .then((res) => res as unknown as AdminActivity)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleNext = () => {
    if (data?.lastEvaluatedKey) {
      setPageKey(encodeURIComponent(JSON.stringify(data.lastEvaluatedKey)));
      load(encodeURIComponent(JSON.stringify(data.lastEvaluatedKey)));
    }
  };

  const items = data?.items ?? [];

  if (loading && !data) {
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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">
        Recent Activity
      </h1>
      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row: AdminActivityItem) => (
              <TableRow key={row.id}>
                <TableCell className="text-dark-6 dark:text-dark-6">
                  {row.date || row.createdAt?.slice(0, 10)}
                </TableCell>
                <TableCell className="font-mono text-sm">{row.businessId}</TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell>
                  {row.currency} {row.amount?.toLocaleString()}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {row.description || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data?.lastEvaluatedKey && (
          <div className="border-t p-4">
            <button
              onClick={handleNext}
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
