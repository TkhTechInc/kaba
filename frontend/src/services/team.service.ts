import { apiGet, apiPatch, apiPost } from "@/lib/api-client";

export type TeamMemberRole = "owner" | "accountant" | "viewer" | "sales";

export interface TeamMember {
  userId: string;
  role: TeamMemberRole;
  createdAt: string;
}

export interface ListMembersResponse {
  success: boolean;
  data: { members: TeamMember[] };
}

export interface CreateInvitationPayload {
  emailOrPhone: string;
  businessId: string;
  role: TeamMemberRole;
  expiresInHours?: number;
}

export interface Invitation {
  id: string;
  businessId: string;
  emailOrPhone: string;
  role: TeamMemberRole;
  invitedBy: string;
  expiresAt: string;
  status: string;
}

export interface CreateInvitationResponse {
  success: boolean;
  data: Invitation;
}

export interface UpdateMemberRoleResponse {
  success: boolean;
  data: { businessId: string; role: TeamMemberRole };
}

export async function listMembers(
  businessId: string,
  token: string | null
): Promise<TeamMember[]> {
  const res = await apiGet<ListMembersResponse>(
    `/api/v1/access/businesses/${encodeURIComponent(businessId)}/members`,
    { token: token ?? undefined }
  );
  if (!res.success || !res.data?.members) {
    throw new Error("Failed to list team members");
  }
  return res.data.members;
}

export async function createInvitation(
  businessId: string,
  emailOrPhone: string,
  role: TeamMemberRole,
  token: string | null,
  expiresInHours?: number
): Promise<Invitation> {
  const res = await apiPost<CreateInvitationResponse>(
    "/api/v1/invitations",
    {
      emailOrPhone,
      businessId,
      role,
      ...(expiresInHours != null && { expiresInHours }),
    },
    { token: token ?? undefined }
  );
  if (!res.success || !res.data) {
    throw new Error("Failed to create invitation");
  }
  return res.data;
}

export async function updateMemberRole(
  businessId: string,
  userId: string,
  role: TeamMemberRole,
  token: string | null
): Promise<{ businessId: string; role: TeamMemberRole }> {
  const res = await apiPatch<UpdateMemberRoleResponse>(
    `/api/v1/access/businesses/${encodeURIComponent(businessId)}/members/${encodeURIComponent(userId)}/role`,
    { role },
    { token: token ?? undefined }
  );
  if (!res.success || !res.data) {
    throw new Error("Failed to update member role");
  }
  return res.data;
}
