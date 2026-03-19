"use client";

import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { createAdminApi } from "@/services/admin.service";
import { useState } from "react";

export default function AdminAIPage() {
  const { t } = useLocale();
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !query.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    createAdminApi(token)
      .aiQuery(query.trim())
      .then((res) => {
        const r = res as { success?: boolean; data?: { answer: string }; answer?: string };
        return r?.data?.answer ?? r?.answer ?? "";
      })
      .then(setAnswer)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">
        {t("admin.ai.title")}
      </h1>
      <p className="mb-4 text-dark-6 dark:text-dark-6">
        {t("admin.ai.description")}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("admin.ai.placeholder")}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? t("admin.ai.querying") : t("admin.ai.ask")}
        </button>
      </form>
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      {answer && (
        <div className="mt-4 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <h2 className="mb-2 font-semibold text-dark dark:text-white">
            {t("admin.ai.answer")}
          </h2>
          <p className="whitespace-pre-wrap text-dark dark:text-gray-300">
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}
