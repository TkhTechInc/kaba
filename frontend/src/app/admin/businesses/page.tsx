"use client";

import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
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
import type { AdminBusiness } from "@/services/admin.service";

const TIERS = ["free", "starter", "pro", "enterprise"] as const;

export default function AdminBusinessesPage() {
  const { token } = useAuth();
  const { t } = useLocale();
  const [items, setItems] = useState<AdminBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    setLoading(true);
    createAdminApi(token)
      .getBusinesses()
      .then((res) => {
        const r = res as { data?: { items: AdminBusiness[] }; items?: AdminBusiness[] };
        const list = r?.data?.items ?? r?.items ?? [];
        setItems(list);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const updateTier = async (businessId: string, tier: string) => {
    if (!token) return;
    setUpdating(businessId);
    setError(null);
    try {
      await createAdminApi(token).updateBusinessTier(businessId, tier);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpdating(null);
    }
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
        {t("admin.businesses.title")}
      </h1>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="overflow-x-auto">
          <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.businesses.id")}</TableHead>
              <TableHead>{t("admin.businesses.tier")}</TableHead>
              <TableHead>{t("admin.businesses.name")}</TableHead>
              <TableHead>{t("admin.businesses.created")}</TableHead>
              <TableHead>{t("admin.businesses.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm">{row.id}</TableCell>
                <TableCell>
                  <select
                    value={row.tier}
                    onChange={(e) => updateTier(row.id, e.target.value)}
                    disabled={updating === row.id}
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>{row.name ?? "-"}</TableCell>
                <TableCell className="text-dark-6 dark:text-dark-6">
                  {row.createdAt?.slice(0, 10) ?? "-"}
                </TableCell>
                <TableCell>
                  {updating === row.id ? (
                    <span className="text-sm text-dark-6">{t("admin.businesses.saving")}</span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        {items.length === 0 && !loading && (
          <p className="p-8 text-center text-dark-6 dark:text-dark-6">
            {t("admin.businesses.noBusinessesFound")}
          </p>
        )}
      </div>
    </div>
  );
}
