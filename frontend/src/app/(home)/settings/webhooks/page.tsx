"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { createWebhooksApi, WEBHOOK_EVENTS } from "@/services/webhooks.service";
import type { Webhook, WebhookEvent } from "@/services/webhooks.service";

const EVENT_DESCRIPTIONS: Record<WebhookEvent, string> = {
  "invoice.created": "A new invoice is created",
  "invoice.paid": "An invoice is marked as paid",
  "payment.received": "A payment is received",
  "ledger.entry.created": "A new ledger entry is recorded",
  "ledger.entry.deleted": "A ledger entry is deleted",
  "inventory.low_stock": "An inventory item falls below minimum stock level",
};

export default function WebhooksPage() {
  const { token, businessId } = useAuth();
  const { hasPermission } = usePermissions(businessId);
  const canWrite = hasPermission("webhooks:write");
  const canRead = hasPermission("webhooks:read");

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [registering, setRegistering] = useState(false);
  const [unregistering, setUnregistering] = useState<string | null>(null);

  const api = createWebhooksApi(token);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await api.list(businessId);
      setWebhooks((res as { success: boolean; data: Webhook[] }).data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !url.trim() || !secret.trim() || events.length === 0) return;
    if (!url.startsWith("https://")) {
      setError("Webhook URL must start with https://");
      return;
    }
    setRegistering(true);
    setError(null);
    try {
      const res = await api.register({
        businessId,
        url: url.trim(),
        secret: secret.trim(),
        events,
      });
      const webhook = (res as { success: boolean; data: Webhook }).data;
      setWebhooks((prev) => [webhook, ...prev]);
      setUrl("");
      setSecret("");
      setEvents([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register webhook");
    } finally {
      setRegistering(false);
    }
  };

  const handleUnregister = async (id: string) => {
    if (!businessId) return;
    setUnregistering(id);
    try {
      await api.unregister(id, businessId);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unregister webhook");
    } finally {
      setUnregistering(null);
    }
  };

  if (!canRead) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        You do not have permission to manage webhooks.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
        <Link href="/settings" className="hover:text-primary">
          Settings
        </Link>
        <span>/</span>
        <span className="text-dark dark:text-white">Webhooks</span>
      </div>

      <h1 className="mb-2 text-heading-4 font-bold text-dark dark:text-white">Webhooks</h1>
      <p className="mb-2 text-sm text-dark-4 dark:text-dark-6">
        Your server will receive a <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">POST</code> request signed with your secret when the selected events occur.
      </p>
      <p className="mb-6 text-sm text-dark-4 dark:text-dark-6">
        Use webhooks to sync data with external systems, trigger automations, or update your own records in real time.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {canWrite && (
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-dark">
          <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Register webhook</h2>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label
                htmlFor="webhook-url"
                className="mb-1.5 block text-sm font-medium text-dark dark:text-white"
              >
                Endpoint URL
              </label>
              <input
                id="webhook-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-server.com/webhooks/quickbooks"
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">Must be an HTTPS URL.</p>
            </div>
            <div>
              <label
                htmlFor="webhook-secret"
                className="mb-1.5 block text-sm font-medium text-dark dark:text-white"
              >
                Signing secret
              </label>
              <input
                id="webhook-secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="A strong random secret"
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">
                We will sign each request with this secret using HMAC-SHA256. Verify it on your server.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                Events
              </label>
              <div className="space-y-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <label
                    key={event}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
                  >
                    <input
                      type="checkbox"
                      checked={events.includes(event)}
                      onChange={(e) =>
                        setEvents((prev) =>
                          e.target.checked ? [...prev, event] : prev.filter((ev) => ev !== event)
                        )
                      }
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <code className="text-xs font-medium text-dark dark:text-white">{event}</code>
                      <p className="text-xs text-dark-4 dark:text-dark-6">
                        {EVENT_DESCRIPTIONS[event]}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={registering || !url.trim() || !secret.trim() || events.length === 0}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {registering ? "Registering…" : "Register webhook"}
            </button>
          </form>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-dark">
        <h2 className="border-b border-gray-200 px-6 py-4 text-lg font-semibold text-dark dark:border-gray-700 dark:text-white">
          Registered webhooks
        </h2>
        {loading ? (
          <div className="p-8 text-center text-dark-4 dark:text-dark-6">Loading…</div>
        ) : webhooks.length === 0 ? (
          <div className="p-8 text-center text-dark-4 dark:text-dark-6">No webhooks registered yet.</div>
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
                    Registered {new Date(webhook.createdAt).toLocaleDateString()} ·{" "}
                    <span
                      className={
                        webhook.enabled
                          ? "text-green-600 dark:text-green-400"
                          : "text-dark-4 dark:text-dark-6"
                      }
                    >
                      {webhook.enabled ? "Active" : "Disabled"}
                    </span>
                  </p>
                </div>
                {canWrite && (
                  <button
                    onClick={() => handleUnregister(webhook.id)}
                    disabled={unregistering === webhook.id}
                    className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {unregistering === webhook.id ? "Removing…" : "Remove"}
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
