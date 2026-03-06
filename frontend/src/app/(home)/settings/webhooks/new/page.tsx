"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { createWebhooksApi, WEBHOOK_EVENTS } from "@/services/webhooks.service";
import type { WebhookEvent } from "@/services/webhooks.service";

const EVENT_DESCRIPTIONS: Record<WebhookEvent, string> = {
  "invoice.created": "A new invoice is created",
  "invoice.paid": "An invoice is marked as paid",
  "payment.received": "A payment is received",
  "ledger.entry.created": "A new ledger entry is recorded",
  "ledger.entry.deleted": "A ledger entry is deleted",
  "inventory.low_stock": "An inventory item falls below minimum stock level",
};

export default function RegisterWebhookPage() {
  const router = useRouter();
  const { token, businessId } = useAuth();
  const { hasPermission } = usePermissions(businessId);
  const canWrite = hasPermission("webhooks:write");
  const canRead = hasPermission("webhooks:read");

  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = createWebhooksApi(token);

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
      await api.register({
        businessId,
        url: url.trim(),
        secret: secret.trim(),
        events,
      });
      router.push("/settings/webhooks");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register webhook");
    } finally {
      setRegistering(false);
    }
  };

  if (!canRead) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
          <Link href="/settings" className="hover:text-primary">Settings</Link>
          <span>/</span>
          <Link href="/settings/webhooks" className="hover:text-primary">Webhooks</Link>
          <span>/</span>
          <span className="text-dark dark:text-white">Register</span>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          You do not have permission to manage webhooks.
        </div>
      </div>
    );
  }

  if (!canWrite) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
          <Link href="/settings" className="hover:text-primary">Settings</Link>
          <span>/</span>
          <Link href="/settings/webhooks" className="hover:text-primary">Webhooks</Link>
          <span>/</span>
          <span className="text-dark dark:text-white">Register</span>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          You do not have permission to register webhooks.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
        <Link href="/settings" className="hover:text-primary">Settings</Link>
        <span>/</span>
        <Link href="/settings/webhooks" className="hover:text-primary">Webhooks</Link>
        <span>/</span>
        <span className="text-dark dark:text-white">Register</span>
      </div>

      <h1 className="mb-2 text-heading-4 font-bold text-dark dark:text-white">
        Register webhook
      </h1>
      <p className="mb-8 text-dark-4 dark:text-dark-6">
        Your server will receive a <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">POST</code> request signed with your secret when the selected events occur.
      </p>

      <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-dark">
        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
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
              placeholder="https://your-server.com/webhooks/kaba"
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
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={registering || !url.trim() || !secret.trim() || events.length === 0}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {registering ? "Registering…" : "Register webhook"}
            </button>
            <Link
              href="/settings/webhooks"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-dark hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
