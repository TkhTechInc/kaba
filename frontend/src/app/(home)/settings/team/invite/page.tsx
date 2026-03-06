"use client";

import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import {
  createInvitation,
  type TeamMemberRole,
} from "@/services/team.service";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLES: { value: TeamMemberRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "accountant", label: "Accountant" },
  { value: "viewer", label: "Viewer" },
  { value: "sales", label: "Sales" },
];

export default function InviteTeamMemberPage() {
  const router = useRouter();
  const { token, businessId } = useAuth();
  const { hasPermission } = usePermissions(businessId);
  const canManage = hasPermission("members:manage" as import("@/types/permissions").Permission);

  const [inviteEmailOrPhone, setInviteEmailOrPhone] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamMemberRole>("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

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
      router.push("/settings/team");
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  if (!canManage) {
    return (
      <div>
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Settings navigation">
          {[
            { label: "Plans", href: "/settings" },
            { label: "Team", href: "/settings/team" },
            { label: "API Keys", href: "/settings/api-keys" },
            { label: "Webhooks", href: "/settings/webhooks" },
            { label: "Compliance", href: "/settings/compliance" },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:text-white dark:hover:border-primary dark:hover:text-primary"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mb-4 flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
          <Link href="/settings" className="hover:text-primary">Settings</Link>
          <span>/</span>
          <Link href="/settings/team" className="hover:text-primary">Team</Link>
          <span>/</span>
          <span className="text-dark dark:text-white">Invite</span>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Only owners can invite team members. Contact your administrator.
        </div>
      </div>
    );
  }

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Settings navigation">
        {[
          { label: "Plans", href: "/settings" },
          { label: "Team", href: "/settings/team" },
          { label: "API Keys", href: "/settings/api-keys" },
          { label: "Webhooks", href: "/settings/webhooks" },
          { label: "Compliance", href: "/settings/compliance" },
        ].map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:text-white dark:hover:border-primary dark:hover:text-primary"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mb-4 flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
        <Link href="/settings" className="hover:text-primary">Settings</Link>
        <span>/</span>
        <Link href="/settings/team" className="hover:text-primary">Team</Link>
        <span>/</span>
        <span className="text-dark dark:text-white">Invite</span>
      </div>

      <h1 className="mb-2 text-heading-4 font-bold text-dark dark:text-white">
        Invite new member
      </h1>
      <p className="mb-8 text-dark-4 dark:text-dark-6">
        Send an invitation to add someone to your team.
      </p>

      <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-dark">
        <form onSubmit={handleInvite} className="space-y-4">
          {inviteError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {inviteError}
            </div>
          )}
          <div>
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
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-dark dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
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
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={inviting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {inviting ? "Sending…" : "Send invitation"}
            </button>
            <Link
              href="/settings/team"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-dark hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
