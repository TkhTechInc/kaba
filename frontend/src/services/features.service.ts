import { apiUrl } from "@/lib/api";

export type FeaturesResponse = {
  success: boolean;
  data: {
    tier: string;
    enabled: Record<string, boolean>;
    limits: Record<string, number | undefined>;
  };
};

export async function getFeatures(
  businessId: string,
  accessToken?: string
): Promise<FeaturesResponse["data"]> {
  const url = new URL(apiUrl("/api/v1/features"));
  url.searchParams.set("businessId", businessId);
  const res = await fetch(url.toString(), {
    headers: {
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch features: ${res.status}`);
  }
  const json: FeaturesResponse = await res.json();
  if (!json.success || !json.data) {
    throw new Error("Invalid features response");
  }
  return json.data;
}
