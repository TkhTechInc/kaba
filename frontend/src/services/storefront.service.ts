import { apiGet, apiPost } from "@/lib/api-client";

export type StorefrontPayDataResponse = {
  success: boolean;
  data: {
    businessName: string;
    amount: number;
    currency: string;
    useKkiaPayWidget: boolean;
    useMomoRequest: boolean;
    intentId?: string;
    paid?: boolean;
  };
};

export async function getStorefrontPayData(
  token: string
): Promise<StorefrontPayDataResponse["data"] | null> {
  const res = await apiGet<StorefrontPayDataResponse>(
    `/api/v1/storefront/pay/${encodeURIComponent(token)}`,
    { skip401Redirect: true }
  );
  if (!res?.success || !res.data) return null;
  return res.data;
}

export async function requestStorefrontMoMo(
  token: string,
  phone: string
): Promise<{ success: boolean }> {
  const res = await apiPost<{ success: boolean }>(
    "/api/v1/storefront/pay/request-momo",
    { token, phone },
    { skip401Redirect: true }
  );
  return { success: res?.success ?? false };
}

export async function confirmStorefrontKkiaPay(
  token: string,
  transactionId: string,
  intentId: string,
  redirectStatus?: string
): Promise<{ success: boolean }> {
  const res = await apiPost<{ success: boolean }>(
    "/api/v1/storefront/pay/confirm-kkiapay",
    { token, transactionId, intentId, ...(redirectStatus && { redirectStatus }) },
    { skip401Redirect: true }
  );
  return { success: res?.success ?? false };
}
