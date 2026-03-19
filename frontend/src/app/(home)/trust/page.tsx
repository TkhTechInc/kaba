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
import { cn } from "@/lib/utils";

function getScoreRingColor(score: number) {
  if (score >= 80) return "stroke-green-500";
  if (score >= 60) return "stroke-blue-500";
  if (score >= 40) return "stroke-amber-500";
  return "stroke-gray-400";
}

function getRecommendationBadgeClass(recommendation: string) {
  switch (recommendation) {
    case "excellent":
      return "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30";
    case "good":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
    case "fair":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    default:
      return "bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30";
  }
}

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
  const [copied, setCopied] = useState(false);

  const api = createTrustApi(token);

  useEffect(() => {
    if (!businessId) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    setLoading(true);
    setError(null);
    api
      .getMyScore(businessId)
      .then((res) => setScore(res.data))
      .catch((e: unknown) => {
        if (controller.signal.aborted) {
          setError(t("errors.trustScoreTimeout"));
        } else if (e instanceof ApiError && e.status === 403) {
          setForbidden(true);
        } else {
          setError(e instanceof Error ? e.message : t("errors.loadTrustScore"));
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setLoading(false);
      });
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName={t("trust.pageName")} />
        <div className="rounded-2xl border border-stroke bg-white p-12 text-center shadow-card-2 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("trust.noBusinessSelected")}</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName={t("trust.pageName")} />
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-stroke bg-white shadow-card-2 dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
        <PermissionDenied resource={t("permissionDenied.resource.trustScore")} backHref="/" backLabel={t("common.goToDashboard")} />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName={t("trust.pageName")} />

      {error && (
        <div className="mb-6 rounded-xl border border-red/20 bg-red/10 px-5 py-4 text-sm font-medium text-red">
          {error}
        </div>
      )}

      {loading ? (
        <div className="overflow-hidden rounded-2xl border border-stroke bg-white shadow-card-2 dark:border-dark-3 dark:bg-gray-dark">
          <div className="flex flex-col items-center justify-center p-16">
            <div className="mb-4 h-32 w-32 animate-pulse rounded-full bg-gray-2 dark:bg-dark-2" />
            <div className="mb-2 h-4 w-24 animate-pulse rounded bg-gray-2 dark:bg-dark-2" />
            <div className="h-3 w-40 animate-pulse rounded bg-gray-2 dark:bg-dark-2" />
          </div>
        </div>
      ) : score ? (
        <div className={cn(
          "grid gap-6",
          shareUrl ? "lg:grid-cols-2" : "mx-auto w-full max-w-2xl"
        )}>
          {/* Main score card */}
          <div className="overflow-hidden rounded-2xl border border-stroke bg-white shadow-card-2 transition-shadow hover:shadow-card-3 dark:border-dark-3 dark:bg-gray-dark dark:hover:shadow-card-4">
            <div className="relative border-b border-stroke bg-gradient-to-br from-gray-1 to-white px-6 py-6 dark:border-dark-3 dark:from-dark-2 dark:to-gray-dark">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-body-2xlg font-bold tracking-tight text-dark dark:text-white">
                    {t("trust.scoreTitle")}
                  </h3>
                  <p className="mt-1 text-sm text-dark-6">
                    {t("trust.lastScored", { date: new Date(score.scoredAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) })}
                  </p>
                </div>
                {features.isEnabled("trust_share") && (
                  <button
                    type="button"
                    onClick={handleShare}
                    disabled={sharing}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-1 transition-all hover:bg-primary/90 hover:shadow-2 disabled:opacity-50"
                  >
                    {sharing ? t("trust.sharing") : t("trust.shareScore")}
                  </button>
                )}
              </div>
            </div>

            <div className="p-8">
              {/* Circular score gauge */}
              <div className="relative mx-auto mb-8 flex h-44 w-44 items-center justify-center">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    className="text-gray-2 dark:text-dark-3"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(score.trustScore / 100) * 326.7} 326.7`}
                    className={cn("transition-all duration-700 ease-out", getScoreRingColor(score.trustScore))}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn(
                    "text-4xl font-bold tabular-nums",
                    score.trustScore >= 80 && "text-green-600 dark:text-green-400",
                    score.trustScore >= 60 && score.trustScore < 80 && "text-blue-600 dark:text-blue-400",
                    score.trustScore >= 40 && score.trustScore < 60 && "text-amber-600 dark:text-amber-400",
                    score.trustScore < 40 && "text-gray-600 dark:text-gray-400"
                  )}>
                    {score.trustScore}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wider text-dark-6">/ 100</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold capitalize",
                  getRecommendationBadgeClass(score.recommendation)
                )}>
                  {t(`trust.recommendation.${score.recommendation}` as Parameters<typeof t>[0])}
                </span>
                {score.marketDayAwarenessApplied && (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {t("trust.marketDayApplied")}
                  </span>
                )}
              </div>

              {/* Score breakdown with progress bars */}
              <div className="mt-8">
                <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-dark-6">
                  {t("trust.scoreBreakdown")}
                </h4>
                <div className="space-y-4">
                  {Object.entries(score.breakdown).map(([key, value]) => {
                    const pct = Math.min(100, Math.round(value));
                    return (
                      <div key={key} className="group">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-sm font-medium text-dark dark:text-white">
                            {t(`trust.breakdown.${key}` as Parameters<typeof t>[0]) || key}
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-dark dark:text-white">
                            {Math.round(value)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-2 dark:bg-dark-2">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500 ease-out",
                              pct >= 80 && "bg-green-500",
                              pct >= 60 && pct < 80 && "bg-blue-500",
                              pct >= 40 && pct < 60 && "bg-amber-500",
                              pct < 40 && "bg-gray-400"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {shareUrl && (
            <div className="overflow-hidden rounded-2xl border border-stroke bg-white shadow-card-2 dark:border-dark-3 dark:bg-gray-dark">
              <div className="border-b border-stroke bg-gradient-to-br from-primary/5 to-transparent px-6 py-5 dark:border-dark-3">
                <h3 className="text-lg font-bold text-dark dark:text-white">
                  {t("trust.shareLink.title")}
                </h3>
                <p className="mt-1 text-sm text-dark-6">
                  {t("trust.shareLink.subtitle")}
                </p>
              </div>
              <div className="p-6">
                <div className="flex gap-3">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 rounded-xl border border-stroke bg-gray-1 px-4 py-3 text-sm font-mono text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={copyShareUrl}
                    className={cn(
                      "shrink-0 rounded-xl px-5 py-3 text-sm font-semibold shadow-1 transition-all",
                      copied
                        ? "bg-green-500 text-white"
                        : "bg-primary text-white hover:bg-primary/90 hover:shadow-2"
                    )}
                  >
                    {copied ? `✓ ${t("trust.shareLink.copied")}` : t("trust.shareLink.copy")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-stroke bg-white p-12 text-center shadow-card-2 dark:border-dark-3 dark:bg-gray-dark">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-2 dark:bg-dark-2">
            <svg className="h-8 w-8 text-dark-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="font-medium text-dark-6">{t("trust.unableToLoad")}</p>
        </div>
      )}
    </>
  );
}
