import { apiPatch } from "@/lib/api-client";

export type Tier = "free" | "starter" | "pro" | "enterprise";

export type UpdateTierResponse = {
  success: boolean;
  data: { id: string; tier: Tier; updatedAt: string };
};

export async function updateBusinessTier(
  businessId: string,
  tier: Tier,
  token: string | null
): Promise<UpdateTierResponse> {
  const res = await apiPatch<UpdateTierResponse>(
    "/api/v1/businesses/tier",
    { businessId, tier },
    { token: token ?? undefined }
  );
  if (!res.success || !res.data) {
    throw new Error("Failed to update tier");
  }
  return res;
}
