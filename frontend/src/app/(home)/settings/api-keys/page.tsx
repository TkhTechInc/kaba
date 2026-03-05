"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { createApiKeysApi, API_KEY_SCOPES } from "@/services/api-keys.service";
import type { ApiKey, CreateApiKeyResult } from "@/services/api-keys.service";

export default function ApiKeysPage() {
  const { token, businessId } = useAuth();
  const { hasPermission } = usePermissions(businessId);
  const canWrite = hasPermission("api_keys:write");
  const canRead = hasPermission("api_keys:read");

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<CreateApiKeyResult | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeKey, setRevokeKey] = useState<{ id: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const api = createApiKeysApi(token);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await api.list(businessId);
      const list = (res as { success?: boolean; data?: ApiKey[] }).data ?? [];
      setKeys(Array.isArray(list) ? list.filter((k): k is ApiKey => k != null && typeof k === "object") : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !name.trim() || scopes.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await api.create({ businessId, name: name.trim(), scopes });
      const data = (res as { success?: boolean; data?: CreateApiKeyResult }).data;
      if (!data) throw new Error("Invalid response");
      const { key, rawKey } = data;
      const isQueued = rawKey?.includes("Queued");
      setNewKeyResult({ key, rawKey: rawKey ?? "" });
      setName("");
      setScopes([]);
      if (!isQueued) setKeys((prev) => [key, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeClick = (id: string) => {
    const keyName = keys.find((k) => k.id === id)?.name ?? "Unnamed key";
    setRevokeKey({ id, name: keyName });
  };

  const handleRevokeConfirm = async () => {
    if (!businessId || !revokeKey) return;
    const { id } = revokeKey;
    setRevokeKey(null);
    setRevoking(id);
    try {
      await api.revoke(id, businessId);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke key");
    } finally {
      setRevoking(null);
    }
  };

  const handleCopyKey = async () => {
    if (!newKeyResult?.rawKey) return;
    try {
      await navigator.clipboard.writeText(newKeyResult.rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard");
    }
  };

  if (!canRead) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        You do not have permission to manage API keys.
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
        <span className="text-dark dark:text-white">API Keys</span>
      </div>

      <h1 className="mb-2 text-heading-4 font-bold text-dark dark:text-white">API Keys</h1>
      <p className="mb-6 text-sm text-dark-4 dark:text-dark-6">
        API keys allow server-to-server access to your business data. Keep them secret.
      </p>

      {newKeyResult && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
          <p className="mb-2 text-sm font-semibold text-green-800 dark:text-green-200">
            API key created — copy it now, it will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-green-100 px-3 py-2 text-sm font-mono text-green-900 dark:bg-green-900/30 dark:text-green-100">
              {newKeyResult.rawKey}
            </code>
            <button
              type="button"
              onClick={handleCopyKey}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-green-600 bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 dark:border-green-500 dark:bg-green-600 dark:hover:bg-green-700"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNewKeyResult(null)}
            className="mt-3 text-xs text-green-700 underline dark:text-green-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {canWrite && (
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-dark">
          <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Create new API key</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label
                htmlFor="key-name"
                className="mb-1.5 block text-sm font-medium text-dark dark:text-white"
              >
                Key name
              </label>
              <input
                id="key-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My integration"
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                Scopes
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {API_KEY_SCOPES.map((scope) => (
                  <label
                    key={scope}
                    className="flex cursor-pointer items-center gap-2 text-sm text-dark dark:text-white"
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={(e) =>
                        setScopes((prev) =>
                          e.target.checked ? [...prev, scope] : prev.filter((s) => s !== scope)
                        )
                      }
                      className="accent-primary"
                    />
                    <code className="text-xs">{scope}</code>
                  </label>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={creating || !name.trim() || scopes.length === 0}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create key"}
            </button>
          </form>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-dark">
        <h2 className="border-b border-gray-200 px-6 py-4 text-lg font-semibold text-dark dark:border-gray-700 dark:text-white">
          Your API keys
        </h2>
        {loading ? (
          <div className="p-8 text-center text-dark-4 dark:text-dark-6">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-dark-4 dark:text-dark-6">No API keys yet.</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {keys.map((key, i) => (
              <div key={key?.id ?? `key-${i}`} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="font-medium text-dark dark:text-white">{key?.name ?? "Unnamed key"}</p>
                  <p className="mt-0.5 text-xs text-dark-4 dark:text-dark-6">
                    {(key?.scopes ?? []).join(", ")} · Created{" "}
                    {key?.createdAt ? new Date(key.createdAt).toLocaleDateString() : "—"}
                  </p>
                  {key?.keyPrefix && (
                    <p className="mt-0.5 font-mono text-xs text-dark-4 dark:text-dark-6">
                      ••••{key.keyPrefix}
                    </p>
                  )}
                </div>
                {canWrite && key?.id && (
                  <button
                    onClick={() => handleRevokeClick(key.id)}
                    disabled={revoking === key.id}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {revoking === key.id ? "Revoking…" : "Revoke"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Revoke confirmation modal */}
      {revokeKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-modal-title"
          onClick={() => setRevokeKey(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 id="revoke-modal-title" className="text-lg font-semibold text-dark dark:text-white">
                Revoke API key
              </h3>
              <button
                type="button"
                onClick={() => setRevokeKey(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mb-6 text-sm text-dark-4 dark:text-dark-6">
              Are you sure you want to revoke <strong className="text-dark dark:text-white">&quot;{revokeKey.name}&quot;</strong>?
              This cannot be undone and any integrations using this key will stop working.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRevokeKey(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeConfirm}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
              >
                Revoke key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
