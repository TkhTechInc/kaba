"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useLocale } from "@/contexts/locale-context";
import { createWebhooksApi } from "@/services/webhooks.service";
import type { Webhook } from "@/services/webhooks.service";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { ApiError } from "@/lib/api-client";

export default function WebhooksPage() {
  const { token, businessId } = useAuth();
  const { hasPermission } = usePermissions(businessId);
  const { t } = useLocale();
  const canWrite = hasPermission("webhooks:write");
  const canRead = hasPermission("webhooks:read");

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [unregistering, setUnregistering] = useState<string | null>(null);

  const api = createWebhooksApi(token);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await api.list(businessId);
      setWebhooks((res as { success: boolean; data: Webhook[] }).data ?? []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
      else setError(e instanceof Error ? e.message : t("webhooks.error.load"));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnregister = async (id: string) => {
    if (!businessId) return;
    setUnregistering(id);
    try {
      await api.unregister(id, businessId);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("webhooks.error.remove"));
    } finally {
      setUnregistering(null);
    }
  };

  if (!canRead || forbidden) {
    return (
      <PermissionDenied
        resource={t("permissionDenied.resource.webhooks")}
        hint={forbidden ? undefined : t("webhooks.noPermission")}
        backHref="/settings"
        backLabel={t("common.backToSettings")}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
        <Link href="/settings" className="hover:text-primary">
          {t("webhooks.breadcrumb.settings")}
        </Link>
        <span>/</span>
        <span className="text-dark dark:text-white">{t("webhooks.breadcrumb.webhooks")}</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-4 font-bold text-dark dark:text-white">{t("webhooks.title")}</h1>
          <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
            {t("webhooks.subtitle")}
          </p>
        </div>
        {canWrite && (
          <Link
            href="/settings/webhooks/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {t("webhooks.registerBtn")}
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-dark">
        <h2 className="border-b border-gray-200 px-6 py-4 text-lg font-semibold text-dark dark:border-gray-700 dark:text-white">
          {t("webhooks.listSection.title")}
        </h2>
        {loading ? (
          <div className="p-8 text-center text-dark-4 dark:text-dark-6">{t("webhooks.listSection.loading")}</div>
        ) : webhooks.length === 0 ? (
          <div className="p-8 text-center text-dark-4 dark:text-dark-6">
            {t("webhooks.listSection.empty")}{" "}
            {canWrite && (
              <Link href="/settings/webhooks/new" className="text-primary hover:underline">
                {t("webhooks.listSection.registerOne")}
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="flex items-start justify-between gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-dark dark:text-white">{webhook.url}</p>
                  <p className="mt-0.5 text-xs text-dark-4 dark:text-dark-6">
                    {webhook.events.join(", ")}
                  </p>
                  <p className="mt-0.5 text-xs text-dark-4 dark:text-dark-6">
                    {t("webhooks.listSection.registered", { date: new Date(webhook.createdAt).toLocaleDateString() })} ·{" "}
                    <span
                      className={
                        webhook.enabled
                          ? "text-green-600 dark:text-green-400"
                          : "text-dark-4 dark:text-dark-6"
                      }
                    >
                      {webhook.enabled ? t("webhooks.listSection.active") : t("webhooks.listSection.disabled")}
                    </span>
                  </p>
                </div>
                {canWrite && (
                  <button
                    onClick={() => handleUnregister(webhook.id)}
                    disabled={unregistering === webhook.id}
                    className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {unregistering === webhook.id ? t("webhooks.listSection.removing") : t("webhooks.listSection.remove")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
