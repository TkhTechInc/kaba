import { apiGet } from "@/lib/api-client";
import { offlineMutation } from "@/lib/offline-api";

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
  const optimistic: CreateInvitationResponse = {
    success: true,
    data: {
      id: "pending-" + Date.now(),
      businessId,
      emailOrPhone,
      role,
      invitedBy: "",
      expiresAt: new Date(Date.now() + (expiresInHours ?? 24) * 60 * 60 * 1000).toISOString(),
      status: "pending",
    },
  };
  const result = await offlineMutation<CreateInvitationResponse>(
    "/api/v1/invitations",
    "POST",
    {
      emailOrPhone,
      businessId,
      role,
      ...(expiresInHours != null && { expiresInHours }),
    },
    token,
    optimistic
  );
  const res = result.data;
  if (!res?.success || !res.data) {
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
  const optimistic: UpdateMemberRoleResponse = {
    success: true,
    data: { businessId, role },
  };
  const result = await offlineMutation<UpdateMemberRoleResponse>(
    `/api/v1/access/businesses/${encodeURIComponent(businessId)}/members/${encodeURIComponent(userId)}/role`,
    "PATCH",
    { role },
    token,
    optimistic
  );
  const res = result.data;
  if (!res?.success || !res.data) {
    throw new Error("Failed to update member role");
  }
  return res.data;
}
