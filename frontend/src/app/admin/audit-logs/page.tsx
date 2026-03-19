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
import type { AuditLogItem } from "@/services/admin.service";

export default function AdminAuditLogsPage() {
  const { token } = useAuth();
  const { t } = useLocale();
  const [data, setData] = useState<{ items: AuditLogItem[]; lastEvaluatedKey?: Record<string, unknown> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = () => {
    if (!token) return;
    setLoading(true);
    createAdminApi(token)
      .getAuditLogs({
        businessId: businessId || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 50,
      })
      .then((res) => {
        const r = res as { success?: boolean; data?: { items: AuditLogItem[]; lastEvaluatedKey?: Record<string, unknown> } };
        const d = r?.data ?? r;
        return d && "items" in d ? d : null;
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const items = data?.items ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">
        {t("admin.auditLogs.title")}
      </h1>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-business-id" className="text-sm font-medium text-dark dark:text-white">
            {t("admin.auditLogs.businessId")}
          </label>
          <input
            id="audit-business-id"
            name="auditBusinessId"
            type="text"
            placeholder={t("admin.auditLogs.placeholder")}
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-date-from" className="text-sm font-medium text-dark dark:text-white">
            {t("admin.auditLogs.from")}
          </label>
          <input
            id="audit-date-from"
            name="auditDateFrom"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-date-to" className="text-sm font-medium text-dark dark:text-white">
            {t("admin.auditLogs.to")}
          </label>
          <input
            id="audit-date-to"
            name="auditDateTo"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Search"}
        </button>
      </div>
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
              <TableHead>{t("admin.auditLogs.time")}</TableHead>
              <TableHead>{t("admin.auditLogs.entity")}</TableHead>
              <TableHead>{t("admin.auditLogs.action")}</TableHead>
              <TableHead>{t("admin.auditLogs.business")}</TableHead>
              <TableHead>{t("admin.auditLogs.user")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-dark-6 dark:text-dark-6">
                  {(row.timestamp ?? row.createdAt ?? "")?.slice(0, 19).replace("T", " ")}
                </TableCell>
                <TableCell>
                  {row.entityType} / {row.entityId}
                </TableCell>
                <TableCell>{row.action}</TableCell>
                <TableCell className="font-mono text-sm">{row.businessId}</TableCell>
                <TableCell>{row.userId ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        {items.length === 0 && !loading && (
          <p className="p-8 text-center text-dark-6 dark:text-dark-6">
            {t("admin.auditLogs.noLogsFound")}
          </p>
        )}
      </div>
    </div>
  );
}
