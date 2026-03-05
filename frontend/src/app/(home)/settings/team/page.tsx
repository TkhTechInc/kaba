"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import {
  listMembers,
  createInvitation,
  updateMemberRole,
  type TeamMember,
  type TeamMemberRole,
} from "@/services/team.service";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const ROLES: { value: TeamMemberRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "accountant", label: "Accountant" },
  { value: "viewer", label: "Viewer" },
  { value: "sales", label: "Sales" },
];

function formatUserId(userId: string): string {
  if (userId.length <= 12) return userId;
  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}

export default function TeamPage() {
  const { token, businessId } = useAuth();
  const { hasPermission } = usePermissions(businessId);
  const canManage = hasPermission("members:manage" as import("@/types/permissions").Permission);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmailOrPhone, setInviteEmailOrPhone] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamMemberRole>("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!businessId || !token) return;
    if (!canManage) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listMembers(businessId, token);
      setMembers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [businessId, token, canManage]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !token || !canManage) return;
    const trimmed = inviteEmailOrPhone.trim();
    if (!trimmed) {
      setInviteError("Enter an email or phone number.");
      return;
    }
    setInviteError(null);
    setInviting(true);
    try {
      await createInvitation(businessId, trimmed, inviteRole, token);
      setInviteEmailOrPhone("");
      setInviteRole("viewer");
      await fetchMembers();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: TeamMemberRole) => {
    if (!businessId || !token || !canManage) return;
    setUpdatingUserId(userId);
    try {
      await updateMemberRole(businessId, userId, newRole, token);
      await fetchMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
        <Link href="/settings" className="hover:text-primary">
          Settings
        </Link>
        <span>/</span>
        <span className="text-dark dark:text-white">Team</span>
      </div>

      <h1 className="mb-4 text-heading-4 font-bold text-dark dark:text-white">
        Team
      </h1>
      <p className="mb-8 text-dark-4 dark:text-dark-6">
        Manage who has access to this business.
      </p>

      {!canManage && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Only owners can manage team members. Contact your administrator to
          change roles or invite new people.
        </div>
      )}

      {canManage && (
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-dark">
          <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">
            Invite new member
          </h2>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <label
                htmlFor="invite-email-phone"
                className="mb-1 block text-sm font-medium text-dark dark:text-white"
              >
                Email or phone
              </label>
              <input
                id="invite-email-phone"
                type="text"
                value={inviteEmailOrPhone}
                onChange={(e) => setInviteEmailOrPhone(e.target.value)}
                placeholder="email@example.com or +234..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-dark dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="min-w-[140px]">
              <label
                htmlFor="invite-role"
                className="mb-1 block text-sm font-medium text-dark dark:text-white"
              >
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamMemberRole)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-dark dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {inviting ? "Sending…" : "Invite"}
            </button>
          </form>
          {inviteError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {inviteError}
            </p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-dark">
        <h2 className="border-b border-gray-200 p-4 text-lg font-semibold text-dark dark:border-gray-700 dark:text-white">
          Members
        </h2>
        {error && (
          <div className="mx-4 mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
        {loading ? (
          <div className="p-8 text-center text-dark-4 dark:text-dark-6">
            Loading…
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-dark-4 dark:text-dark-6">
            No members yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-dark dark:text-white">
                  Member
                </TableHead>
                <TableHead className="text-dark dark:text-white">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell className="font-mono text-sm text-dark dark:text-white">
                    {formatUserId(m.userId)}
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          handleRoleChange(m.userId, e.target.value as TeamMemberRole)
                        }
                        disabled={updatingUserId === m.userId}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-dark dark:border-gray-600 dark:bg-gray-800 dark:text-white disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="capitalize text-dark dark:text-white">
                        {m.role}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
