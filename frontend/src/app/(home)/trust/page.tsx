"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { useLocale } from "@/contexts/locale-context";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { createTrustApi } from "@/services/trust.service";
import type { TrustScoreResult } from "@/services/trust.service";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { ApiError } from "@/lib/api-client";
import { useEffect, useState } from "react";

export default function TrustPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const { t } = useLocale();
  const [score, setScore] = useState<TrustScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const api = createTrustApi(token);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    api
      .getMyScore(businessId)
      .then((res) => setScore(res.data))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : "Failed to load trust score");
      })
      .finally(() => setLoading(false));
  }, [businessId]);

  const handleShare = () => {
    if (!businessId) return;
    setSharing(true);
    api
      .shareScore(businessId)
      .then((res) => setShareUrl(res.data.shareUrl))
      .catch((e) => setError(e.message))
      .finally(() => setSharing(false));
  };

  const copyShareUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
    }
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName={t("trust.pageName")} />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("trust.noBusinessSelected")}</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName={t("trust.pageName")} />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("trust_score")) {
    return (
      <>
        <Breadcrumb pageName={t("trust.pageName")} />
        <UpgradePrompt feature="Trust score (Sika Trust)" />
      </>
    );
  }

  if (forbidden) {
    return (
      <>
        <Breadcrumb pageName={t("trust.pageName")} />
        <PermissionDenied resource="Trust Score" backHref="/" backLabel="Go to Dashboard" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName={t("trust.pageName")} />

      {error && (
        <div className="mb-6 rounded-lg bg-red/10 p-4 text-red">{error}</div>
      )}

      {loading ? (
        <div className="rounded-lg border border-stroke bg-white p-12 text-center dark:border-dark-3 dark:bg-gray-dark">
          {t("trust.loading")}
        </div>
      ) : score ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
            <div className="flex items-center justify-between border-b border-stroke px-6 py-4 dark:border-dark-3">
              <h3 className="font-semibold text-dark dark:text-white">
                {t("trust.scoreTitle")}
              </h3>
              {features.isEnabled("trust_share") && (
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={sharing}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {sharing ? t("trust.sharing") : t("trust.shareScore")}
                </button>
              )}
            </div>
            <div className="p-6">
              <div className="mb-6 flex items-center justify-center">
                <div
                  className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold ${
                    score.trustScore >= 80
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : score.trustScore >= 60
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : score.trustScore >= 40
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {score.trustScore}
                </div>
              </div>
              <p className="mb-4 text-center text-sm capitalize text-dark-6">
                {score.recommendation} • {t("trust.lastScored", { date: new Date(score.scoredAt).toLocaleDateString() })}
              </p>
              {score.marketDayAwarenessApplied && (
                <p className="mb-4 text-center text-xs text-dark-6">
                  {t("trust.marketDayApplied")}
                </p>
              )}

              <h4 className="mb-3 text-sm font-medium text-dark dark:text-white">
                {t("trust.scoreBreakdown")}
              </h4>
              <div className="space-y-2">
                {Object.entries(score.breakdown).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-dark-6">
                      {t(`trust.breakdown.${key}` as Parameters<typeof t>[0]) || key}
                    </span>
                    <span className="font-medium text-dark dark:text-white">
                      {Math.round(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {shareUrl && (
            <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
              <h3 className="mb-4 font-semibold text-dark dark:text-white">
                {t("trust.shareLink.title")}
              </h3>
              <p className="mb-3 text-sm text-dark-6">
                {t("trust.shareLink.subtitle")}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 rounded-lg border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2"
                />
                <button
                  type="button"
                  onClick={copyShareUrl}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                >
                  {t("trust.shareLink.copy")}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("trust.unableToLoad")}</p>
        </div>
      )}
    </>
  );
}
