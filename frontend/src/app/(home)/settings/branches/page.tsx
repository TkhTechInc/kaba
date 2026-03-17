"use client";

import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { usePermissions } from "@/hooks/use-permissions";
import { listOrganizations, type OrganizationAccess } from "@/services/access.service";
import {
  listBranches,
  createBranch,
  createOrganization,
  unlinkBranch,
  listBranchMembers,
  inviteToBranch,
  removeBranchMember,
  type Branch,
  type BranchMember,
} from "@/services/branch.service";
import { deleteCached, CACHE_KEYS } from "@/lib/offline-cache";
import { useCallback, useEffect, useState } from "react";

const COUNTRY_CODES = ["BJ", "BF", "CI", "CM", "GH", "ML", "NE", "NG", "SN", "TG"];
const CURRENCIES: Record<string, string> = {
  BJ: "XOF", BF: "XOF", CI: "XOF", ML: "XOF", NE: "XOF", SN: "XOF", TG: "XOF",
  CM: "XAF",
  GH: "GHS",
  NG: "NGN",
};

type MainView = "idle" | "create-org" | "create-branch";
type BranchView = "members" | "invite";

export default function BranchesPage() {
  const { t } = useLocale();
  const { token, businessId, user } = useAuth();
  const userId = user?.id;
  const { hasPermission } = usePermissions(businessId);
  const canManage = hasPermission("members:manage" as import("@/types/permissions").Permission);

  const ROLES: { value: BranchMember["role"]; label: string; description: string }[] = [
    { value: "owner",      label: t("roles.owner"),      description: t("roles.ownerDesc") },
    { value: "manager",    label: t("roles.manager"),    description: t("roles.managerDesc") },
    { value: "accountant", label: t("roles.accountant"), description: t("roles.accountantDesc") },
    { value: "viewer",     label: t("roles.viewer"),     description: t("roles.viewerDesc") },
    { value: "sales",      label: t("roles.sales"),      description: t("roles.salesDesc") },
  ];

  // Org state
  const [organizations, setOrganizations] = useState<OrganizationAccess[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  // Branch list state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  // Expanded branch panel state
  const [expandedBranchId, setExpandedBranchId] = useState<string | null>(null);
  const [branchPanelView, setBranchPanelView] = useState<BranchView>("members");
  const [members, setMembers] = useState<BranchMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  // Invite form state
  const [inviteEmailOrPhone, setInviteEmailOrPhone] = useState("");
  const [inviteRole, setInviteRole] = useState<BranchMember["role"]>("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Remove member state
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  // Unlink branch state
  const [unlinkingBranchId, setUnlinkingBranchId] = useState<string | null>(null);

  // Main form view
  const [view, setView] = useState<MainView>("idle");

  // Create org form
  const [orgName, setOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  // Create branch form
  const [branchName, setBranchName] = useState("");
  const [branchCountry, setBranchCountry] = useState("");
  const [branchCurrency, setBranchCurrency] = useState("");
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [createBranchError, setCreateBranchError] = useState<string | null>(null);

  const refreshOrgs = useCallback(async () => {
    if (!token) return;
    setLoadingOrgs(true);
    try {
      await deleteCached(`${CACHE_KEYS.ORGANIZATIONS}:user`).catch(() => {});
      const orgs = await listOrganizations(token);
      setOrganizations(orgs);
      if (orgs.length === 1 && !selectedOrgId) setSelectedOrgId(orgs[0].id);
    } catch {
      setOrganizations([]);
    } finally {
      setLoadingOrgs(false);
    }
  }, [token, selectedOrgId]);

  useEffect(() => {
    refreshOrgs();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBranches = useCallback(async (orgId: string) => {
    if (!token || !orgId) return;
    setLoadingBranches(true);
    setBranchError(null);
    setExpandedBranchId(null);
    try {
      const data = await listBranches(orgId, token);
      setBranches(data);
    } catch (e) {
      setBranchError(e instanceof Error ? e.message : t("branches.list.loadError"));
    } finally {
      setLoadingBranches(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (selectedOrgId) loadBranches(selectedOrgId);
    else setBranches([]);
  }, [selectedOrgId, loadBranches]);

  const loadMembers = useCallback(async (branchId: string) => {
    if (!token || !selectedOrgId) return;
    setLoadingMembers(true);
    setMemberError(null);
    try {
      const data = await listBranchMembers(selectedOrgId, branchId, token);
      setMembers(data);
    } catch (e) {
      setMemberError(e instanceof Error ? e.message : t("branches.panel.membersLoadError"));
    } finally {
      setLoadingMembers(false);
    }
  }, [token, selectedOrgId, t]);

  const handleExpandBranch = (branchId: string) => {
    if (expandedBranchId === branchId) {
      setExpandedBranchId(null);
      return;
    }
    setExpandedBranchId(branchId);
    setBranchPanelView("members");
    setInviteSuccess(false);
    setInviteError(null);
    setInviteEmailOrPhone("");
    setInviteRole("viewer");
    loadMembers(branchId);
  };

  // ── Create organization ───────────────────────────────────────────────────
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !businessId || !orgName.trim()) return;
    setCreatingOrg(true);
    setOrgError(null);
    try {
      const org = await createOrganization(orgName.trim(), businessId, token);
      await refreshOrgs();
      setSelectedOrgId(org.id);
      setOrgName("");
      setView("idle");
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : t("branches.createOrg.failed"));
    } finally {
      setCreatingOrg(false);
    }
  };

  // ── Create branch ─────────────────────────────────────────────────────────
  const handleCountryChange = (cc: string) => {
    setBranchCountry(cc);
    setBranchCurrency(CURRENCIES[cc] ?? "");
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !businessId || !selectedOrgId || !branchName.trim()) return;
    setCreatingBranch(true);
    setCreateBranchError(null);
    try {
      await createBranch(
        { organizationId: selectedOrgId, name: branchName.trim(), countryCode: branchCountry || undefined, currency: branchCurrency || undefined, parentBusinessId: businessId },
        token
      );
      setBranchName("");
      setBranchCountry("");
      setBranchCurrency("");
      setView("idle");
      await loadBranches(selectedOrgId);
    } catch (err) {
      setCreateBranchError(err instanceof Error ? err.message : t("branches.createBranch.failed"));
    } finally {
      setCreatingBranch(false);
    }
  };

  // ── Unlink branch ─────────────────────────────────────────────────────────
  const handleUnlinkBranch = async (branchId: string) => {
    if (!token || !selectedOrgId) return;
    if (!confirm(t("branches.row.unlinkConfirm"))) return;
    setUnlinkingBranchId(branchId);
    try {
      await unlinkBranch(selectedOrgId, branchId, token);
      if (expandedBranchId === branchId) setExpandedBranchId(null);
      await loadBranches(selectedOrgId);
    } catch (e) {
      alert(e instanceof Error ? e.message : t("branches.unlinkFailed"));
    } finally {
      setUnlinkingBranchId(null);
    }
  };

  // ── Invite to branch ──────────────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedOrgId || !expandedBranchId || !inviteEmailOrPhone.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    try {
      await inviteToBranch(selectedOrgId, expandedBranchId, inviteEmailOrPhone.trim(), inviteRole, token);
      setInviteSuccess(true);
      setInviteEmailOrPhone("");
      setInviteRole("viewer");
      setBranchPanelView("members");
      await loadMembers(expandedBranchId);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : t("branches.panel.inviteFailed"));
    } finally {
      setInviting(false);
    }
  };

  // ── Remove member ─────────────────────────────────────────────────────────
  const handleRemoveMember = async (targetUserId: string) => {
    if (!token || !selectedOrgId || !expandedBranchId) return;
    if (!confirm(t("branches.panel.removeConfirm"))) return;
    setRemovingUserId(targetUserId);
    try {
      await removeBranchMember(selectedOrgId, expandedBranchId, targetUserId, token);
      await loadMembers(expandedBranchId);
    } catch (e) {
      alert(e instanceof Error ? e.message : t("branches.removeMemberFailed"));
    } finally {
      setRemovingUserId(null);
    }
  };

  const noOrgs = !loadingOrgs && organizations.length === 0;

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-heading-4 font-bold text-dark dark:text-white">{t("branches.title")}</h1>
          <p className="mt-1 text-dark-4 dark:text-dark-6">
            {t("branches.subtitle")}
          </p>
        </div>
        {canManage && !loadingOrgs && !noOrgs && view === "idle" && (
          <div className="flex gap-2">
            <button
              onClick={() => setView("create-org")}
              className="inline-flex items-center gap-1 rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:text-white dark:hover:border-primary"
            >
              {t("branches.newOrg")}
            </button>
            {selectedOrgId && (
              <button
                onClick={() => setView("create-branch")}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                {t("branches.addBranch")}
              </button>
            )}
          </div>
        )}
      </div>

      {!canManage && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {t("branches.restricted")}
        </div>
      )}

      {/* ── Create organization form ───────────────────────────────────────── */}
      {view === "create-org" && canManage && (
        <div className="mb-6 rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
          <h2 className="mb-1 text-base font-semibold text-dark dark:text-white">{t("branches.createOrg.title")}</h2>
          <p className="mb-4 text-sm text-dark-4 dark:text-dark-6">
            {t("branches.createOrg.subtitle")}
          </p>
          <form onSubmit={handleCreateOrg} className="space-y-4">
            {orgError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{orgError}</div>}
            <div>
              <label htmlFor="org-name" className="mb-1 block text-sm font-medium text-dark dark:text-white">
                {t("branches.createOrg.nameLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                id="org-name"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder={t("branches.createOrg.namePlaceholder")}
                required
                autoFocus
                className="w-full max-w-sm rounded-lg border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={creatingOrg || !orgName.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                {creatingOrg ? t("branches.createOrg.submitting") : t("branches.createOrg.submit")}
              </button>
              <button type="button" onClick={() => { setView("idle"); setOrgError(null); setOrgName(""); }}
                className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2">
                {t("branches.createOrg.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Create branch form ─────────────────────────────────────────────── */}
      {view === "create-branch" && canManage && selectedOrgId && (
        <div className="mb-6 rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
          <h2 className="mb-4 text-base font-semibold text-dark dark:text-white">{t("branches.createBranch.title")}</h2>
          <form onSubmit={handleCreateBranch} className="space-y-4">
            {createBranchError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{createBranchError}</div>}
            <div>
              <label htmlFor="branch-name" className="mb-1 block text-sm font-medium text-dark dark:text-white">
                {t("branches.createBranch.nameLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                id="branch-name"
                name="branchName"
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder={t("branches.createBranch.namePlaceholder")}
                required
                autoFocus
                className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="branch-country" className="mb-1 block text-sm font-medium text-dark dark:text-white">{t("branches.createBranch.countryLabel")}</label>
                <select id="branch-country" name="branchCountry" value={branchCountry} onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white">
                  <option value="">{t("branches.createBranch.countryPlaceholder")}</option>
                  {COUNTRY_CODES.map((cc) => <option key={cc} value={cc}>{cc}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="branch-currency" className="mb-1 block text-sm font-medium text-dark dark:text-white">{t("branches.createBranch.currencyLabel")}</label>
                <input id="branch-currency" name="branchCurrency" type="text" value={branchCurrency} onChange={(e) => setBranchCurrency(e.target.value)}
                  placeholder={t("branches.createBranch.currencyPlaceholder")}
                  className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={creatingBranch || !branchName.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                {creatingBranch ? t("branches.createBranch.submitting") : t("branches.createBranch.submit")}
              </button>
              <button type="button" onClick={() => { setView("idle"); setCreateBranchError(null); }}
                className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2">
                {t("branches.createBranch.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {noOrgs && view === "idle" && (
        <div className="rounded-lg border border-dashed border-stroke bg-white p-10 text-center dark:border-dark-3 dark:bg-gray-dark">
          <p className="mb-1 font-medium text-dark dark:text-white">{t("branches.emptyState.title")}</p>
          <p className="mb-4 text-sm text-dark-4 dark:text-dark-6">
            {t("branches.emptyState.description")}
          </p>
          {canManage && (
            <button onClick={() => setView("create-org")}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
              {t("branches.emptyState.createBtn")}
            </button>
          )}
        </div>
      )}

      {/* ── Organization selector ─────────────────────────────────────────── */}
      {!noOrgs && (
        <div className="mb-6">
          <label htmlFor="org-select" className="mb-2 block text-sm font-medium text-dark dark:text-white">{t("branches.orgSelector.label")}</label>
          <select id="org-select" name="selectedOrgId" value={selectedOrgId}
            onChange={(e) => { setSelectedOrgId(e.target.value); setBranches([]); setExpandedBranchId(null); }}
            disabled={loadingOrgs}
            className="w-full max-w-sm rounded-lg border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white disabled:opacity-60">
            <option value="">{loadingOrgs ? t("branches.orgSelector.loading") : t("branches.orgSelector.default")}</option>
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}

      {/* ── Branches list with expandable member panels ────────────────────── */}
      {selectedOrgId && (
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-dark">
          <h2 className="border-b border-gray-200 p-4 text-base font-semibold text-dark dark:border-gray-700 dark:text-white">
            {t("branches.list.title")}
          </h2>
          {branchError && (
            <div className="mx-4 mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{branchError}</div>
          )}
          {loadingBranches ? (
            <div className="flex min-h-[100px] items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : branches.length === 0 ? (
            <p className="p-6 text-center text-sm text-dark-4 dark:text-dark-6">
              {t("branches.list.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {branches.map((branch) => {
                const isExpanded = expandedBranchId === branch.id;
                const isUnlinking = unlinkingBranchId === branch.id;
                return (
                  <li key={branch.id}>
                    {/* Branch row */}
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-dark dark:text-white">{branch.name ?? "—"}</span>
                          {branch.currency && (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {branch.currency}
                            </span>
                          )}
                          {branch.countryCode && (
                            <span className="text-xs text-dark-4 dark:text-dark-6">{branch.countryCode}</span>
                          )}
                        </div>
                        <div className="font-mono text-xs text-gray-400 mt-0.5">{branch.id}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => handleExpandBranch(branch.id)}
                          className="rounded-lg border border-stroke px-3 py-1.5 text-xs font-medium text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:text-white dark:hover:border-primary"
                        >
                          {isExpanded ? t("branches.row.close") : t("branches.row.team")}
                        </button>
                        {canManage && (
                          <button
                            onClick={() => handleUnlinkBranch(branch.id)}
                            disabled={isUnlinking}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                          >
                            {isUnlinking ? t("branches.row.unlinking") : t("branches.row.unlink")}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable member panel */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 pb-4 pt-3 dark:border-gray-700 dark:bg-dark-2">
                        {/* Panel tabs */}
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setBranchPanelView("members"); setInviteSuccess(false); }}
                              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${branchPanelView === "members" ? "bg-primary text-white" : "text-dark-4 hover:text-primary dark:text-dark-6"}`}
                            >
                              {t("branches.panel.members")}
                            </button>
                            {canManage && (
                              <button
                                onClick={() => { setBranchPanelView("invite"); setInviteSuccess(false); setInviteError(null); }}
                                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${branchPanelView === "invite" ? "bg-primary text-white" : "text-dark-4 hover:text-primary dark:text-dark-6"}`}
                              >
                                {t("branches.panel.invite")}
                              </button>
                            )}
                          </div>
                          <span className="text-xs text-dark-4 dark:text-dark-6">
                            {branch.name ?? branch.id}
                          </span>
                        </div>

                        {/* Members tab */}
                        {branchPanelView === "members" && (
                          <>
                            {inviteSuccess && (
                              <div className="mb-3 rounded-lg bg-green-50 p-2.5 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
                                {t("branches.panel.inviteSuccess")}
                              </div>
                            )}
                            {memberError && (
                              <div className="mb-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">{memberError}</div>
                            )}
                            {loadingMembers ? (
                              <div className="flex h-12 items-center justify-center">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              </div>
                            ) : members.length === 0 ? (
                              <p className="text-center text-xs text-dark-4 dark:text-dark-6 py-4">
                                {t("branches.panel.membersEmpty")}
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {members.map((m) => (
                                  <li key={m.userId} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-dark">
                                    <div>
                                      <div className="text-xs font-medium text-dark dark:text-white font-mono">{m.userId}</div>
                                      <div className="text-xs text-dark-4 dark:text-dark-6 capitalize">{m.role}</div>
                                    </div>
                                    {canManage && m.userId !== userId && (
                                      <button
                                        onClick={() => handleRemoveMember(m.userId)}
                                        disabled={removingUserId === m.userId}
                                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
                                      >
                                        {removingUserId === m.userId ? t("branches.panel.removing") : t("branches.panel.remove")}
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}

                        {/* Invite tab */}
                        {branchPanelView === "invite" && canManage && (
                          <form onSubmit={handleInvite} className="space-y-3">
                            {inviteError && (
                              <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">{inviteError}</div>
                            )}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-xs font-medium text-dark dark:text-white">
                                  {t("branches.panel.emailOrPhone")} <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={inviteEmailOrPhone}
                                  onChange={(e) => setInviteEmailOrPhone(e.target.value)}
                                  placeholder={t("branches.panel.emailOrPhonePlaceholder")}
                                  required
                                  className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-dark dark:text-white">{t("branches.panel.roleLabel")}</label>
                                <select
                                  value={inviteRole}
                                  onChange={(e) => setInviteRole(e.target.value as BranchMember["role"])}
                                  className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                                >
                                  {ROLES.map((r) => (
                                    <option key={r.value} value={r.value}>
                                      {r.label} — {r.description}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button type="submit" disabled={inviting || !inviteEmailOrPhone.trim()}
                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                                {inviting ? t("branches.panel.sending") : t("branches.panel.send")}
                              </button>
                              <button type="button" onClick={() => { setBranchPanelView("members"); setInviteError(null); }}
                                className="rounded-lg border border-stroke px-3 py-1.5 text-xs font-medium text-dark hover:bg-gray-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2">
                                {t("branches.panel.cancel")}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
