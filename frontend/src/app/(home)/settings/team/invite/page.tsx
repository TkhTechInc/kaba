"use client";

import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { usePermissions } from "@/hooks/use-permissions";
import { createInvitation, type TeamMemberRole } from "@/services/team.service";
import { listOrganizations } from "@/services/access.service";
import { listBranches, inviteToBranch, type Branch } from "@/services/branch.service";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function InviteTeamMemberPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { token, businessId } = useAuth();
  const { hasPermission } = usePermissions(businessId);
  const canManage = hasPermission("members:manage" as import("@/types/permissions").Permission);

  const SETTINGS_NAV = [
    { label: t("settings.nav.plans"),       href: "/settings" },
    { label: t("settings.nav.team"),        href: "/settings/team" },
    { label: t("settings.nav.activityLog"), href: "/settings/activity" },
    { label: t("settings.nav.preferences"), href: "/settings/preferences" },
    { label: t("settings.nav.apiKeys"),     href: "/settings/api-keys" },
    { label: t("settings.nav.webhooks"),    href: "/settings/webhooks" },
    { label: t("settings.nav.compliance"),  href: "/settings/compliance" },
  ];

  const ROLES: { value: TeamMemberRole; label: string; description: string }[] = [
    { value: "owner",      label: t("roles.owner"),      description: t("roles.ownerDesc") },
    { value: "manager",    label: t("roles.manager"),    description: t("roles.managerDesc") },
    { value: "accountant", label: t("roles.accountant"), description: t("roles.accountantDesc") },
    { value: "viewer",     label: t("roles.viewer"),     description: t("roles.viewerDesc") },
    { value: "sales",      label: t("roles.sales"),      description: t("roles.salesDesc") },
  ];

  const [inviteEmailOrPhone, setInviteEmailOrPhone] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamMemberRole>("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [targetType, setTargetType] = useState<"current" | "branch">("current");

  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("");

  useEffect(() => {
    if (targetType !== "branch" || !token || orgs.length > 0) return;
    setLoadingOrgs(true);
    listOrganizations(token)
      .then(setOrgs)
      .catch(() => setOrgs([]))
      .finally(() => setLoadingOrgs(false));
  }, [targetType, token, orgs.length]);

  useEffect(() => {
    if (!selectedOrgId || !token) {
      setBranches([]);
      setSelectedBranchId("");
      return;
    }
    setLoadingBranches(true);
    listBranches(selectedOrgId, token)
      .then((data) => { setBranches(data); setSelectedBranchId(""); })
      .catch(() => setBranches([]))
      .finally(() => setLoadingBranches(false));
  }, [selectedOrgId, token]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !canManage) return;
    const trimmed = inviteEmailOrPhone.trim();
    if (!trimmed) { setInviteError(t("invite.form.emptyField")); return; }

    if (targetType === "branch") {
      if (!selectedOrgId || !selectedBranchId) {
        setInviteError(t("invite.form.selectBranch"));
        return;
      }
    } else {
      if (!businessId) return;
    }

    setInviteError(null);
    setInviting(true);
    try {
      if (targetType === "branch") {
        await inviteToBranch(selectedOrgId, selectedBranchId, trimmed, inviteRole, token);
      } else {
        await createInvitation(businessId!, trimmed, inviteRole, token);
      }
      router.push("/settings/team");
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : t("invite.form.sendFailed"));
    } finally {
      setInviting(false);
    }
  };

  if (!canManage) {
    return (
      <div>
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Settings navigation">
          {SETTINGS_NAV.map(({ label, href }) => (
            <Link key={href} href={href}
              className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:text-white dark:hover:border-primary dark:hover:text-primary">
              {label}
            </Link>
          ))}
        </nav>
        <div className="mb-4 flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
          <Link href="/settings" className="hover:text-primary">{t("invite.breadcrumb.settings")}</Link>
          <span>/</span>
          <Link href="/settings/team" className="hover:text-primary">{t("invite.breadcrumb.team")}</Link>
          <span>/</span>
          <span className="text-dark dark:text-white">{t("invite.breadcrumb.invite")}</span>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {t("invite.restricted")}
        </div>
      </div>
    );
  }

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Settings navigation">
        {SETTINGS_NAV.map(({ label, href }) => (
          <Link key={href} href={href}
            className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:text-white dark:hover:border-primary dark:hover:text-primary">
            {label}
          </Link>
        ))}
      </nav>
      <div className="mb-4 flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
        <Link href="/settings" className="hover:text-primary">{t("invite.breadcrumb.settings")}</Link>
        <span>/</span>
        <Link href="/settings/team" className="hover:text-primary">{t("invite.breadcrumb.team")}</Link>
        <span>/</span>
        <span className="text-dark dark:text-white">{t("invite.breadcrumb.invite")}</span>
      </div>

      <h1 className="mb-2 text-heading-4 font-bold text-dark dark:text-white">{t("invite.title")}</h1>
      <p className="mb-8 text-dark-4 dark:text-dark-6">
        {t("invite.subtitle")}
      </p>

      <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-dark">
        <form onSubmit={handleInvite} className="space-y-5">
          {inviteError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {inviteError}
            </div>
          )}

          {/* Invite target */}
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">{t("invite.form.inviteTo")}</label>
            <div className="flex gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="target"
                  value="current"
                  checked={targetType === "current"}
                  onChange={() => setTargetType("current")}
                  className="accent-primary"
                />
                <span className="text-sm text-dark dark:text-white">{t("invite.form.thisBusiness")}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="target"
                  value="branch"
                  checked={targetType === "branch"}
                  onChange={() => setTargetType("branch")}
                  className="accent-primary"
                />
                <span className="text-sm text-dark dark:text-white">{t("invite.form.specificBranch")}</span>
              </label>
            </div>
          </div>

          {/* Branch selector (only shown in branch mode) */}
          {targetType === "branch" && (
            <div className="space-y-3 rounded-lg border border-stroke p-4 dark:border-dark-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-white">{t("invite.form.organization")}</label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  disabled={loadingOrgs}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-dark dark:border-gray-600 dark:bg-gray-800 dark:text-white disabled:opacity-60"
                >
                  <option value="">{loadingOrgs ? t("invite.form.orgLoading") : orgs.length === 0 ? t("invite.form.orgEmpty") : t("invite.form.orgDefault")}</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              {selectedOrgId && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">{t("invite.form.branch")}</label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={loadingBranches}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-dark dark:border-gray-600 dark:bg-gray-800 dark:text-white disabled:opacity-60"
                  >
                    <option value="">{loadingBranches ? t("invite.form.branchLoading") : branches.length === 0 ? t("invite.form.branchEmpty") : t("invite.form.branchDefault")}</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name ?? b.id}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Email / phone */}
          <div>
            <label htmlFor="invite-email-phone" className="mb-1 block text-sm font-medium text-dark dark:text-white">
              {t("invite.form.emailOrPhone")}
            </label>
            <input
              id="invite-email-phone"
              type="text"
              value={inviteEmailOrPhone}
              onChange={(e) => setInviteEmailOrPhone(e.target.value)}
              placeholder={t("invite.form.emailOrPhonePlaceholder")}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-dark dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Role */}
          <div>
            <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-dark dark:text-white">{t("invite.form.role")}</label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as TeamMemberRole)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-dark dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={inviting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
              {inviting ? t("invite.form.sending") : t("invite.form.send")}
            </button>
            <Link href="/settings/team"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-dark hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800">
              {t("invite.form.cancel")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
