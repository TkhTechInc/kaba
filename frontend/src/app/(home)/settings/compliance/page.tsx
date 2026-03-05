"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { apiGet } from "@/lib/api-client";
import Link from "next/link";

const SETTINGS_NAV = [
  { label: "Plans", href: "/settings" },
  { label: "Team", href: "/settings/team" },
  { label: "API Keys", href: "/settings/api-keys" },
  { label: "Webhooks", href: "/settings/webhooks" },
  { label: "Compliance", href: "/settings/compliance" },
];

export default function CompliancePage() {
  const { token, businessId } = useAuth();
  const { hasPermission } = usePermissions(businessId);
  const canExport = hasPermission("compliance:export");
  const canErase = hasPermission("compliance:erasure");

  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [eraseConfirm, setEraseConfirm] = useState(false);
  const [eraseDone, setEraseDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!businessId || !token) return;
    setExporting(true);
    setError(null);
    try {
      const res = await apiGet<{ success: boolean; data: unknown }>(
        `/api/v1/compliance/export?businessId=${encodeURIComponent(businessId)}`,
        { token }
      );
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kaba-export-${businessId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleErase = async () => {
    if (!businessId || !token) return;
    setErasing(true);
    setError(null);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1/compliance/erasure`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ businessId }),
        }
      );
      setEraseDone(true);
      setEraseConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erasure request failed");
    } finally {
      setErasing(false);
    }
  };

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Settings navigation">
        {SETTINGS_NAV.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:text-white dark:hover:border-primary dark:hover:text-primary"
          >
            {label}
          </Link>
        ))}
      </nav>

      <h1 className="mb-2 text-heading-4 font-bold text-dark dark:text-white">Compliance & Privacy</h1>
      <p className="mb-6 text-sm text-dark-4 dark:text-dark-6">
        Manage your data rights under applicable privacy regulations (GDPR, NDPR).
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</div>
      )}

      <div className="space-y-4">
        <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
          <h2 className="mb-1 text-base font-semibold text-dark dark:text-white">Export your data</h2>
          <p className="mb-4 text-sm text-dark-4 dark:text-dark-6">
            Download all your business data as a JSON file. This includes ledger entries, invoices, customers, and receipts.
          </p>
          {!canExport ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">Only owners and accountants can export data.</p>
          ) : exportDone ? (
            <p className="text-sm text-green-700 dark:text-green-400">Export downloaded successfully.</p>
          ) : (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {exporting ? "Exporting…" : "Download my data"}
            </button>
          )}
        </div>

        <div className="rounded-lg border border-red/20 bg-white p-6 shadow-sm dark:bg-gray-dark">
          <h2 className="mb-1 text-base font-semibold text-dark dark:text-white">Request data erasure</h2>
          <p className="mb-4 text-sm text-dark-4 dark:text-dark-6">
            Request permanent deletion of all your business data. This action cannot be undone. Your account and all associated data will be scheduled for erasure.
          </p>
          {!canErase ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">Only business owners can request data erasure.</p>
          ) : eraseDone ? (
            <p className="text-sm text-green-700 dark:text-green-400">Erasure request submitted. You will be contacted to confirm.</p>
          ) : !eraseConfirm ? (
            <button
              onClick={() => setEraseConfirm(true)}
              className="rounded-lg border border-red/40 px-5 py-2 text-sm font-medium text-red hover:bg-red/5"
            >
              Request erasure
            </button>
          ) : (
            <div className="rounded-lg border border-red/30 bg-red-50 p-4 dark:bg-red-950/20">
              <p className="mb-3 text-sm font-medium text-red-800 dark:text-red-300">
                Are you sure? This will permanently delete all your data and cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleErase}
                  disabled={erasing}
                  className="rounded-lg bg-red px-4 py-1.5 text-sm font-medium text-white hover:bg-red/90 disabled:opacity-50"
                >
                  {erasing ? "Submitting…" : "Yes, delete my data"}
                </button>
                <button
                  onClick={() => setEraseConfirm(false)}
                  className="rounded-lg border border-stroke px-4 py-1.5 text-sm text-dark dark:border-dark-3 dark:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
