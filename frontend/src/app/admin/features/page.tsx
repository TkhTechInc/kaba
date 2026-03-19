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
import type { FeatureConfig } from "@/services/admin.service";

const TIERS = ["free", "starter", "pro", "enterprise"] as const;

export default function AdminFeaturesPage() {
  const { t } = useLocale();
  const { token } = useAuth();
  const [data, setData] = useState<Record<string, FeatureConfig> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    setLoading(true);
    createAdminApi(token)
      .getFeatures()
      .then((res) => {
        const r = res as { success?: boolean; data?: Record<string, FeatureConfig> };
        const out: Record<string, FeatureConfig> = (r?.data ?? {}) as Record<string, FeatureConfig>;
        setData(out);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleSave = async (
    key: string,
    config: Partial<FeatureConfig>
  ) => {
    if (!token) return;
    setUpdating(key);
    setError(null);
    try {
      await createAdminApi(token).updateFeature(key, config);
      setEditing(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpdating(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const entries = data ? Object.entries(data) : [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">
        {t("admin.features.title")}
      </h1>
      <p className="mb-4 text-sm text-dark-6 dark:text-dark-6">
        {t("admin.features.subtitle")}
      </p>
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
              <TableHead>{t("admin.features.feature")}</TableHead>
              <TableHead>{t("admin.features.enabled")}</TableHead>
              <TableHead>{t("admin.features.tiers")}</TableHead>
              <TableHead>{t("admin.features.limits")}</TableHead>
              <TableHead className="w-[80px]">{t("admin.features.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([key, cfg]) => (
              <FeatureRow
                key={key}
                featureKey={key}
                config={cfg}
                isEditing={editing === key}
                isUpdating={updating === key}
                onEdit={() => setEditing(editing === key ? null : key)}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
                t={t}
              />
            ))}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({
  featureKey,
  config,
  isEditing,
  isUpdating,
  onEdit,
  onSave,
  onCancel,
  t,
}: {
  featureKey: string;
  config: FeatureConfig;
  isEditing: boolean;
  isUpdating: boolean;
  onEdit: () => void;
  onSave: (key: string, config: Partial<FeatureConfig>) => Promise<void>;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [tiers, setTiers] = useState<string[]>(config.tiers ?? []);
  const [limits, setLimits] = useState<Record<string, number>>(
    config.limits ?? {}
  );

  // Sync form state when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEnabled(config.enabled);
      setTiers(config.tiers ?? []);
      setLimits(config.limits ?? {});
    }
  }, [isEditing, config.enabled, config.tiers, config.limits]);

  const toggleTier = (t: string) => {
    setTiers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort()
    );
  };

  const setLimit = (tier: string, value: string) => {
    const n = value === "" ? undefined : parseInt(value, 10);
    setLimits((prev) => {
      const next = { ...prev };
      if (n === undefined || isNaN(n)) delete next[tier];
      else next[tier] = n;
      return next;
    });
  };

  const handleSave = () => {
    onSave(featureKey, {
      enabled,
      tiers,
      limits: Object.keys(limits).length ? limits : undefined,
    });
  };

  if (isEditing) {
    return (
      <>
        <TableRow>
          <TableCell colSpan={5} className="bg-gray-50 dark:bg-gray-800/50 p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <span>{t("admin.features.enabled")}:</span>
                  <select
                    value={enabled ? "yes" : "no"}
                    onChange={(e) => setEnabled(e.target.value === "yes")}
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="yes">{t("admin.features.yes")}</option>
                    <option value="no">{t("admin.features.no")}</option>
                  </select>
                </label>
              </div>
              <div>
                <span className="text-sm font-medium">{t("admin.features.tiers")}:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {TIERS.map((t) => (
                    <label
                      key={t}
                      className="flex cursor-pointer items-center gap-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600"
                    >
                      <input
                        type="checkbox"
                        checked={tiers.includes(t)}
                        onChange={() => toggleTier(t)}
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium">{t("admin.features.limitsOptional")}</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {TIERS.map((t) => (
                    <label key={t} className="flex items-center gap-1 text-sm">
                      <span>{t}:</span>
                      <input
                        type="number"
                        min={0}
                        value={limits[t] ?? ""}
                        onChange={(e) => setLimit(t, e.target.value)}
                        placeholder="-"
                        className="w-20 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="rounded bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {isUpdating ? t("admin.features.saving") : t("admin.features.save")}
                </button>
                <button
                  onClick={onCancel}
                  disabled={isUpdating}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      </>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{featureKey}</TableCell>
      <TableCell>{config.enabled ? t("admin.features.yes") : t("admin.features.no")}</TableCell>
      <TableCell className="text-dark-6 dark:text-dark-6">
        {config.tiers?.join(", ") ?? "-"}
      </TableCell>
      <TableCell className="text-dark-6 dark:text-dark-6">
        {config.limits
          ? Object.entries(config.limits)
              .map(([t, n]) => `${t}: ${n}`)
              .join("; ")
          : "-"}
      </TableCell>
      <TableCell>
        <button
          onClick={onEdit}
          className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          {t("admin.features.edit")}
        </button>
      </TableCell>
    </TableRow>
  );
}
