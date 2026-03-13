import { apiUrl } from "@/lib/api";
import { deleteCached, CACHE_KEYS } from "@/lib/offline-cache";

export type Branch = {
  id: string;
  name?: string;
  countryCode?: string;
  currency?: string;
  tier?: string;
  organizationId?: string;
  createdAt?: string;
};

export type OrgSummary = {
  id: string;
  name: string;
};

export type CreateBranchInput = {
  organizationId: string;
  name: string;
  countryCode?: string;
  currency?: string;
  parentBusinessId: string;
};

export type BranchMember = {
  userId: string;
  role: "owner" | "manager" | "accountant" | "viewer" | "sales";
  createdAt: string;
};

export async function createOrganization(
  name: string,
  businessId: string,
  token: string
): Promise<OrgSummary> {
  const res = await fetch(apiUrl("/api/v1/org"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, businessId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Failed to create organization: ${res.status}`);
  }
  const json = await res.json() as { success: boolean; data: OrgSummary };
  await deleteCached(`${CACHE_KEYS.ORGANIZATIONS}:user`).catch(() => {});
  return json.data;
}

export async function listBranches(
  organizationId: string,
  token: string
): Promise<Branch[]> {
  const res = await fetch(
    apiUrl(`/api/v1/org/${encodeURIComponent(organizationId)}/branches`),
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Failed to load branches: ${res.status}`);
  const json = await res.json() as { success: boolean; data: Branch[] };
  if (!json.success) throw new Error("Failed to load branches");
  return json.data;
}

export async function createBranch(
  input: CreateBranchInput,
  token: string
): Promise<Branch> {
  const res = await fetch(apiUrl("/api/v1/org/branches"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...input,
      businessId: input.parentBusinessId,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Failed to create branch: ${res.status}`);
  }
  const json = await res.json() as { success: boolean; data: Branch };
  return json.data;
}

export async function unlinkBranch(
  organizationId: string,
  branchId: string,
  token: string
): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/org/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}`),
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Failed to unlink branch: ${res.status}`);
  }
}

export async function listBranchMembers(
  organizationId: string,
  branchId: string,
  token: string
): Promise<BranchMember[]> {
  const res = await fetch(
    apiUrl(`/api/v1/org/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/members`),
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Failed to load members: ${res.status}`);
  const json = await res.json() as { success: boolean; data: BranchMember[] };
  return json.data ?? [];
}

export async function inviteToBranch(
  organizationId: string,
  branchId: string,
  emailOrPhone: string,
  role: BranchMember["role"],
  token: string
): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/org/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/members/invite`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ emailOrPhone, role }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Failed to send invitation: ${res.status}`);
  }
}

export async function removeBranchMember(
  organizationId: string,
  branchId: string,
  targetUserId: string,
  token: string
): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/org/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/members/${encodeURIComponent(targetUserId)}`),
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Failed to remove member: ${res.status}`);
  }
}
