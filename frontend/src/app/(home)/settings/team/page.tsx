"use client";

import { ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { usePermissions } from "@/hooks/use-permissions";
import {
  listMembers,
  updateMemberRole,
  type TeamMember,
  type TeamMemberRole,
} from "@/services/team.service";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { ApiError } from "@/lib/api-client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatUserId(userId: string): string {
  if (userId.length <= 12) return userId;
  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}

export default function TeamPage() {
  const { t } = useLocale();
  const { token, businessId } = useAuth();
  const { hasPermission } = usePermissions(businessId);
  const canManage = hasPermission("members:manage" as import("@/types/permissions").Permission);

  const ROLES: { value: TeamMemberRole; label: string }[] = [
    { value: "owner",      label: t("roles.owner") },
    { value: "manager",    label: t("roles.manager") },
    { value: "accountant", label: t("roles.accountant") },
    { value: "viewer",     label: t("roles.viewer") },
    { value: "sales",      label: t("roles.sales") },
  ];

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

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
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
      else setError(e instanceof Error ? e.message : t("team.loadError"));
    } finally {
      setLoading(false);
    }
  }, [businessId, token, canManage, t]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleRoleChange = async (userId: string, newRole: TeamMemberRole) => {
    if (!businessId || !token || !canManage) return;
    setUpdatingUserId(userId);
    try {
      await updateMemberRole(businessId, userId, newRole, token);
      await fetchMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("team.updateError"));
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (forbidden) {
    return (
      <div>
        <PermissionDenied
          resource="Team Management"
          backHref="/settings"
          backLabel="Back to Settings"
        />
      </div>
    );
  }

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Settings navigation">
        {[
          { label: t("settings.nav.plans"), href: "/settings/plans"},
          { label: t("settings.nav.team"), href: "/settings/team" },
          { label: t("settings.nav.activityLog"), href: "/settings/activity" },
          { label: t("settings.nav.preferences"), href: "/settings/preferences" },
          { label: t("settings.nav.apiKeys"), href: "/settings/api-keys" },
          { label: t("settings.nav.webhooks"), href: "/settings/webhooks" },
          { label: t("settings.nav.compliance"), href: "/settings/compliance" },
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
        <Link href="/settings" className="hover:text-primary">
          {t("team.breadcrumb.settings")}
        </Link>
        <span>/</span>
        <span className="text-dark dark:text-white">{t("team.breadcrumb.team")}</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-4 font-bold text-dark dark:text-white">
            {t("team.title")}
          </h1>
          <p className="mt-1 text-dark-4 dark:text-dark-6">
            {t("team.subtitle")}
          </p>
        </div>
        {canManage && (
          <Link
            href="/settings/team/invite"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {t("team.inviteBtn")}
          </Link>
        )}
      </div>

      {!canManage && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {t("team.restrictedNotice")}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-dark">
        <h2 className="border-b border-gray-200 p-4 text-lg font-semibold text-dark dark:border-gray-700 dark:text-white">
          {t("team.members.title")}
        </h2>
        {error && (
          <div className="mx-4 mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
        {loading ? (
          <div className="p-8 text-center text-dark-4 dark:text-dark-6">
            {t("team.members.loading")}
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-dark-4 dark:text-dark-6">
            {t("team.members.empty")}
          </div>
        ) : (
          <ResponsiveDataList<TeamMember>
            items={members}
            keyExtractor={(m) => m.userId}
            emptyMessage={t("team.members.empty")}
            columns={[
              {
                key: "member",
                label: t("team.members.member"),
                render: (m) => (
                  <span className="font-mono text-sm text-dark dark:text-white">
                    {formatUserId(m.userId)}
                  </span>
                ),
                prominent: true,
              },
              {
                key: "role",
                label: t("team.members.role"),
                render: (m) =>
                  canManage ? (
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
                    <span className="capitalize text-dark dark:text-white">{m.role}</span>
                  ),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}
