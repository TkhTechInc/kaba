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
import type { FeatureConfig } from "@/services/admin.service";

export default function AdminFeaturesPage() {
  const { token } = useAuth();
  const [data, setData] = useState<Record<string, FeatureConfig> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    createAdminApi(token)
      .getFeatures()
      .then((res) => {
        const r = res as { success?: boolean; data?: Record<string, FeatureConfig> };
        const out: Record<string, FeatureConfig> = (r?.data ?? {}) as Record<string, FeatureConfig>;
        setData(out);
      })
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

  const entries = data ? Object.entries(data) : [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">
        Feature Config
      </h1>
      <p className="mb-4 text-sm text-dark-6 dark:text-dark-6">
        Read-only display of feature toggles per tier.
      </p>
      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Feature</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead>Tiers</TableHead>
              <TableHead>Limits</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([key, cfg]) => (
              <TableRow key={key}>
                <TableCell className="font-medium">{key}</TableCell>
                <TableCell>{cfg.enabled ? "Yes" : "No"}</TableCell>
                <TableCell className="text-dark-6 dark:text-dark-6">
                  {cfg.tiers?.join(", ") ?? "-"}
                </TableCell>
                <TableCell className="text-dark-6 dark:text-dark-6">
                  {cfg.limits
                    ? Object.entries(cfg.limits)
                        .map(([t, n]) => `${t}: ${n}`)
                        .join("; ")
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
