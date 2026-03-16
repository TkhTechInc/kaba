import { apiGet, apiPost } from "@/lib/api-client";

export type Tier = "free" | "starter" | "pro" | "enterprise";

export type PlanCheckoutResponse = {
  success: boolean;
  data: {
    token: string;
    payUrl: string;
    amount: number;
    currency: string;
    useKkiaPayWidget: boolean;
  };
};

export type PlanPayDataResponse = {
  success: boolean;
  data: {
    businessName: string;
    targetTier: string;
    amount: number;
    currency: string;
    useKkiaPayWidget: boolean;
    useMomoRequest?: boolean;
    intentId?: string;
    upgraded?: boolean;
    kkiapayPublicKey?: string;
    kkiapaySandbox?: boolean;
  };
};

export async function createPlanCheckout(
  businessId: string,
  targetTier: Tier,
  token: string | null
): Promise<PlanCheckoutResponse["data"]> {
  const res = await apiPost<PlanCheckoutResponse>(
    "/api/v1/plans/checkout",
    { businessId, targetTier },
    { token: token ?? undefined }
  );
  if (!res?.success || !res.data) {
    throw new Error("Failed to create checkout");
  }
  return res.data;
}

export async function getPlanPayData(
  token: string
): Promise<PlanPayDataResponse["data"] | null> {
  const res = await apiGet<PlanPayDataResponse>(
    `/api/v1/plans/pay/${encodeURIComponent(token)}`,
    { skip401Redirect: true }
  );
  if (!res?.success || !res.data) return null;
  return res.data;
}

export async function requestPlanMoMo(
  token: string,
  phone: string
): Promise<{ success: boolean }> {
  const res = await apiPost<{ success: boolean }>(
    "/api/v1/plans/pay/request-momo",
    { token, phone },
    { skip401Redirect: true }
  );
  return { success: res?.success ?? false };
}

export async function confirmPlanKkiaPay(
  token: string,
  transactionId: string,
  intentId: string,
  redirectStatus?: string
): Promise<{ success: boolean; businessId?: string }> {
  const res = await apiPost<{ success: boolean; businessId?: string }>(
    "/api/v1/plans/pay/confirm-kkiapay",
    { token, transactionId, intentId, ...(redirectStatus && { redirectStatus }) },
    { skip401Redirect: true }
  );
  return {
    success: res?.success ?? false,
    businessId: res?.businessId,
  };
}
