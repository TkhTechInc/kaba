import { offlineMutation } from "@/lib/offline-api";

export type Tier = "free" | "starter" | "pro" | "enterprise";

export type UpdateTierResponse = {
  success: boolean;
  data: {
    id: string;
    tier: Tier;
    updatedAt: string;
    scheduledDowngradeTier?: Tier;
    subscriptionEndsAt?: string;
  };
};

export async function updateBusinessTier(
  businessId: string,
  tier: Tier,
  token: string | null
): Promise<UpdateTierResponse> {
  const optimistic: UpdateTierResponse = {
    success: true,
    data: { id: businessId, tier, updatedAt: new Date().toISOString() },
  };
  const result = await offlineMutation<UpdateTierResponse>(
    "/api/v1/businesses/tier",
    "PATCH",
    { businessId, tier },
    token,
    optimistic
  );
  const res = result.data;
  if (!res?.success || !res.data) {
    throw new Error("Failed to update tier");
  }
  return res;
}
