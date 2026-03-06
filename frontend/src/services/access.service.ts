import { apiUrl } from "@/lib/api";
import { apiGetWithOfflineCache } from "@/lib/api-client";
import { CACHE_KEYS } from "@/lib/offline-cache";

export type BusinessAccess = {
  businessId: string;
  role: "owner" | "manager" | "accountant" | "viewer" | "sales";
};

export type OrganizationAccess = {
  id: string;
  name: string;
};

export type ListBusinessesResponse = {
  success: boolean;
  data: BusinessAccess[];
};


export async function listBusinesses(
  accessToken?: string
): Promise<BusinessAccess[]> {
  const res = await fetch(apiUrl("/api/v1/access/businesses"), {
    headers: {
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch businesses: ${res.status}`);
  }
  const json: ListBusinessesResponse = await res.json();
  if (!json.success || !Array.isArray(json.data)) {
    throw new Error("Invalid businesses response");
  }
  return json.data;
}

export async function listOrganizations(
  accessToken?: string
): Promise<OrganizationAccess[]> {
  const res = await apiGetWithOfflineCache<OrganizationAccess[]>(
    "/api/v1/access/organizations",
    `${CACHE_KEYS.ORGANIZATIONS}:user`,
    { token: accessToken ?? undefined }
  );
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error("Invalid organizations response");
  }
  return res.data;
}
