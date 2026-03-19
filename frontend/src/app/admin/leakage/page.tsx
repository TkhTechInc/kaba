"use client";

import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { createAdminApi } from "@/services/admin.service";
import type { LeakageAnomaly } from "@/services/admin.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";

export default function AdminLeakagePage() {
  const { t } = useLocale();
  const { token } = useAuth();
  const [anomalies, setAnomalies] = useState<LeakageAnomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = () => {
    if (!token || !businessId.trim()) return;
    setLoading(true);
    setError(null);
    createAdminApi(token)
      .getLeakageReport({
        businessId,
        from: from || undefined,
        to: to || undefined,
      })
      .then((res) => {
        const r = res as { success?: boolean; data?: { anomalies: LeakageAnomaly[] } };
        const d = r?.data ?? r;
        return d && "anomalies" in d ? d.anomalies : [];
      })
      .then(setAnomalies)
      .catch((e) => {
        setError(e.message);
        setAnomalies([]);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">
        {t("admin.leakage.title")}
      </h1>
      <p className="mb-4 text-sm text-dark-6">
        {t("admin.leakage.subtitle")}
      </p>
      <div className="mb-4 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder={t("admin.leakage.businessIdPlaceholder")}
          value={businessId}
          onChange={(e) => setBusinessId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <input
          type="date"
          placeholder={t("admin.leakage.from")}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <input
          type="date"
          placeholder={t("admin.leakage.to")}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <button
          onClick={load}
          disabled={loading || !businessId.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? t("common.loading") : t("admin.leakage.runReport")}
        </button>
      </div>
      {error && (
        <div className="mb-4 rounded bg-red/10 p-3 text-sm text-red">
          {error}
        </div>
      )}
      {anomalies.length > 0 ? (
        <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.leakage.userId")}</TableHead>
              <TableHead>{t("admin.leakage.hour")}</TableHead>
              <TableHead className="text-right">{t("admin.leakage.invoices")}</TableHead>
              <TableHead className="text-right">{t("admin.leakage.reconciliations")}</TableHead>
              <TableHead className="text-right">{t("admin.leakage.gap")}</TableHead>
              <TableHead>{t("admin.leakage.severity")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {anomalies.map((a, i) => (
              <TableRow key={`${a.userId}-${a.hourWindow}-${i}`}>
                <TableCell className="font-mono text-sm">{a.userId}</TableCell>
                <TableCell>{a.hourWindow}</TableCell>
                <TableCell className="text-right">{a.invoiceCount}</TableCell>
                <TableCell className="text-right">
                  {a.reconciliationCount}
                </TableCell>
                <TableCell className="text-right">{a.gap}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      a.severity === "high"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        : a.severity === "medium"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-gray-100 text-gray-700 dark:bg-dark-2 dark:text-dark-6"
                    }`}
                  >
                    {a.severity}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      ) : (
        !loading && (
          <p className="text-dark-6">
            {businessId.trim()
              ? t("admin.leakage.noAnomalies")
              : t("admin.leakage.enterBusinessId")}
          </p>
        )
      )}
    </div>
  );
}
