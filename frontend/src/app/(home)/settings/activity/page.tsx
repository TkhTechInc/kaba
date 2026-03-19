"use client";

import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { usePermissions } from "@/hooks/use-permissions";
import { apiUrl } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { PermissionDenied } from "@/components/ui/permission-denied";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ResponsiveDataList } from "@/components/ui/responsive-data-list";

type AuditItem = {
  id?: string;
  timestamp?: string;
  createdAt?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

type AuditResponse = {
  success: boolean;
  data: {
    items: AuditItem[];
    lastEvaluatedKey?: Record<string, unknown>;
  };
};

async function fetchActivity(
  token: string,
  businessId: string,
  from?: string,
  to?: string,
  lastKey?: Record<string, unknown>
): Promise<AuditResponse["data"]> {
  const params = new URLSearchParams();
  params.set("businessId", businessId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (lastKey) params.set("lastEvaluatedKey", encodeURIComponent(JSON.stringify(lastKey)));
  const res = await fetch(apiUrl(`/api/v1/audit/activity?${params.toString()}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new ApiError(err.message ?? `Failed to load activity: ${res.status}`, res.status);
  }
  const json = await res.json() as AuditResponse;
  return json.data;
}

export default function ActivityLogPage() {
  const { t } = useLocale();
  const { token, businessId } = useAuth();
  const { hasPermission } = usePermissions(businessId);
  const canView = hasPermission("audit:read" as import("@/types/permissions").Permission);

  const SETTINGS_NAV = [
    { label: t("settings.nav.plans"), href: "/settings/plans"},
    { label: t("settings.nav.team"), href: "/settings/team" },
    { label: t("settings.nav.activityLog"), href: "/settings/activity" },
    { label: t("settings.nav.preferences"), href: "/settings/preferences" },
    { label: t("settings.nav.apiKeys"), href: "/settings/api-keys" },
    { label: t("settings.nav.webhooks"), href: "/settings/webhooks" },
    { label: t("settings.nav.compliance"), href: "/settings/compliance" },
  ];

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [lastKey, setLastKey] = useState<Record<string, unknown> | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async (append = false, key?: Record<string, unknown>) => {
    if (!token || !businessId || !canView) return;
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const data = await fetchActivity(token, businessId, from, to, key);
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setLastKey(data.lastEvaluatedKey);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
      else setError(e instanceof Error ? e.message : t("activity.loadError"));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token, businessId, canView, from, to, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setItems([]);
    setLastKey(undefined);
    load(false);
  };

  const formatTime = (item: AuditItem) => {
    const ts = item.timestamp ?? item.createdAt ?? "";
    if (!ts) return "—";
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const formatAction = (action?: string) => {
    if (!action) return "—";
    return action.replace(/\./g, " › ").replace(/_/g, " ");
  };

  if (forbidden) {
    return (
      <div>
        <PermissionDenied
          resource={t("permissionDenied.resource.activityLog")}
          backHref="/settings"
          backLabel={t("common.backToSettings")}
        />
      </div>
    );
  }

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

      <div className="mb-4 flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
        <Link href="/settings" className="hover:text-primary">{t("activity.breadcrumb.settings")}</Link>
        <span>/</span>
        <span className="text-dark dark:text-white">{t("activity.breadcrumb.activityLog")}</span>
      </div>

      <div className="mb-6">
        <h1 className="text-heading-4 font-bold text-dark dark:text-white">{t("activity.title")}</h1>
        <p className="mt-1 text-dark-4 dark:text-dark-6">
          {t("activity.subtitle")}
        </p>
      </div>

      {!canView ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {t("activity.restricted")}
        </div>
      ) : (
        <>
          <form onSubmit={handleSearch} className="mb-6 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-dark-4 dark:text-dark-6">{t("activity.from")}</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-dark-4 dark:text-dark-6">{t("activity.to")}</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? t("activity.searching") : t("activity.search")}
            </button>
          </form>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
            {loading && items.length === 0 ? (
              <div className="flex min-h-[120px] items-center justify-center p-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="-mx-4 sm:mx-0">
                <ResponsiveDataList<AuditItem & { _key: string }>
                  items={items.map((row, i) => ({ ...row, _key: row.id ?? `row-${i}` }))}
                  keyExtractor={(row) => row._key}
                  emptyMessage={t("activity.empty")}
                  columns={[
                    {
                      key: "time",
                      label: t("activity.time"),
                      render: (row) => (
                        <span className="whitespace-nowrap text-sm text-dark-4 dark:text-dark-6">
                          {formatTime(row)}
                        </span>
                      ),
                      prominent: true,
                    },
                    {
                      key: "what",
                      label: t("activity.what"),
                      render: (row) => (
                        <>
                          <span className="font-medium text-dark dark:text-white">{row.entityType ?? "—"}</span>
                          {row.entityId && (
                            <span className="ml-1 font-mono text-xs text-gray-400">
                              {row.entityId.length > 20 ? `${row.entityId.slice(0, 16)}…` : row.entityId}
                            </span>
                          )}
                        </>
                      ),
                    },
                    {
                      key: "action",
                      label: t("activity.action"),
                      render: (row) => (
                        <span className="capitalize text-dark dark:text-white">
                          {formatAction(row.action)}
                        </span>
                      ),
                    },
                    {
                      key: "user",
                      label: t("activity.user"),
                      render: (row) => (
                        <span className="font-mono text-xs text-dark-4 dark:text-dark-6">
                          {row.userId
                            ? row.userId.length > 12
                              ? `${row.userId.slice(0, 8)}…${row.userId.slice(-4)}`
                              : row.userId
                            : "—"}
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {lastKey && !loadingMore && items.length > 0 && (
              <div className="border-t border-stroke p-4 dark:border-dark-3">
                <button
                  type="button"
                  onClick={() => load(true, lastKey)}
                  className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                >
                  {t("activity.loadMore")}
                </button>
              </div>
            )}

            {loadingMore && (
              <div className="flex items-center justify-center p-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
