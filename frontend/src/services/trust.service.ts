import { api } from "@/lib/api-client";

export interface TrustScoreResult {
  businessId: string;
  trustScore: number;
  breakdown: {
    repaymentVelocity: number;
    transactionRecency: number;
    momoReconciliation: number;
    customerRetention: number;
    networkDiversity: number;
  };
  marketDayAwarenessApplied: boolean;
  recommendation: "excellent" | "good" | "fair" | "poor";
  scoredAt: string;
}

export interface MoMoUploadResult {
  transactions: Array<{ type: string; amount: number; currency: string; date: string; reference?: string }>;
  savedRecord: {
    businessId: string;
    month: string;
    momoTotal: number;
    declaredTotal: number;
    currency: string;
    rate: number;
    transactionCount: number;
    uploadedAt: string;
  };
}

export interface ShareResult {
  shareUrl: string;
  token: string;
  expiresAt: string;
  trustScore: number;
}

export function createTrustApi(token: string | null) {
  return {
    getMyScore: (businessId: string) =>
      api.get<TrustScoreResult>(
        `/api/v1/trust/my-score?businessId=${encodeURIComponent(businessId)}`,
        { token: token ?? undefined }
      ),

    uploadMoMo: (businessId: string, smsText: string, month: string, declaredTotal: number, currency: string) =>
      api.post<MoMoUploadResult>("/api/v1/trust/momo-upload", {
        businessId,
        smsText,
        month,
        declaredTotal,
        currency,
      }, { token: token ?? undefined }),

    shareScore: (businessId: string) =>
      api.post<ShareResult>("/api/v1/trust/share", { businessId }, { token: token ?? undefined }),

    updateMarketDay: (businessId: string, marketDayCycle: number) =>
      api.post<{ message: string }>("/api/v1/trust/market-day", {
        businessId,
        marketDayCycle,
      }, { token: token ?? undefined }),
  };
}
