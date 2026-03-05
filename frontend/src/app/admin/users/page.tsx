"use client";

import { useAuth } from "@/contexts/auth-context";
import { createAdminApi } from "@/services/admin.service";
import type { AdminUser } from "@/services/admin.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";

const ROLES = ["admin", "user"] as const;

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [items, setItems] = useState<AdminUser[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState<
    Record<string, unknown> | undefined
  >(undefined);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadUsers = (
    append: boolean,
    nextKey?: Record<string, unknown>
  ) => {
    if (!token) return;
    if (!append) setListLoading(true);
    else setLoadMoreLoading(true);
    setListError(null);
    createAdminApi(token)
      .getUsers({
        limit: 50,
        lastEvaluatedKey: nextKey
          ? encodeURIComponent(JSON.stringify(nextKey))
          : undefined,
      })
      .then((res) => {
        const data = (res as { data?: { items: AdminUser[]; lastEvaluatedKey?: Record<string, unknown> } })?.data;
        const list = data?.items ?? [];
        setItems((prev) => (append ? [...prev, ...list] : list));
        setLastEvaluatedKey(data?.lastEvaluatedKey);
      })
      .catch((e) => setListError(e instanceof Error ? e.message : "Failed to load users"))
      .finally(() => {
        setListLoading(false);
        setLoadMoreLoading(false);
      });
  };

  useEffect(() => {
    if (!token) return;
    loadUsers(false);
  }, [token]);

  const loadMore = () => {
    if (!lastEvaluatedKey || loadMoreLoading) return;
    loadUsers(true, lastEvaluatedKey);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !phone.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await createAdminApi(token).createUserByPhone(phone.trim(), role);
      const data = (res as { success?: boolean; data?: { id: string; phone: string } })?.data;
      setSuccess(`User created: ${data?.phone ?? phone} (ID: ${data?.id ?? "—"})`);
      setPhone("");
      loadUsers(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId: string, newRole: "admin" | "user") => {
    if (!token) return;
    setUpdating(userId);
    setListError(null);
    try {
      await createAdminApi(token).updateUserRole(userId, newRole);
      setItems((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (e) {
      setListError((e as Error).message);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">
        Admin Users
      </h1>
      <p className="mb-4 text-sm text-dark-6 dark:text-dark-6">
        Users must be created before they can log in with phone + OTP. Add a phone number to grant access.
      </p>

      <form
        onSubmit={handleCreate}
        className="mb-6 max-w-md rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark"
      >
        <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">
          Create Phone User
        </h2>
        <div className="mb-4">
          <label htmlFor="phone" className="mb-2 block text-sm font-medium text-dark dark:text-white">
            Phone number
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+2348012345678"
            className="w-full rounded-lg border border-stroke px-4 py-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="role" className="mb-2 block text-sm font-medium text-dark dark:text-white">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "user")}
            className="w-full rounded-lg border border-stroke px-4 py-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {success && (
          <p className="mb-4 text-sm text-green-600 dark:text-green-400">{success}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90 disabled:opacity-70"
        >
          {loading ? "Creating…" : "Create user"}
        </button>
      </form>

      <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">
        All Users
      </h2>
      {listError && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {listError}
        </div>
      )}
      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm">{row.id}</TableCell>
                <TableCell>{row.phone ?? "-"}</TableCell>
                <TableCell>{row.email ?? "-"}</TableCell>
                <TableCell>
                  <select
                    value={row.role ?? "user"}
                    onChange={(e) => updateRole(row.id, e.target.value as "admin" | "user")}
                    disabled={updating === row.id}
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  {updating === row.id ? (
                    <span className="text-sm text-dark-6">Saving...</span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {listLoading && items.length === 0 && (
          <div className="flex min-h-[200px] items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {items.length === 0 && !listLoading && (
          <p className="p-8 text-center text-dark-6 dark:text-dark-6">
            No users found.
          </p>
        )}
        {lastEvaluatedKey && items.length > 0 && (
          <div className="border-t border-stroke p-4 dark:border-dark-3">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadMoreLoading}
              className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 disabled:opacity-70"
            >
              {loadMoreLoading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <h2 className="mb-2 font-medium text-amber-800 dark:text-amber-200">
          Phone login flow
        </h2>
        <ol className="list-inside list-decimal space-y-1 text-sm text-amber-700 dark:text-amber-300">
          <li>Admin creates user with phone number (above)</li>
          <li>User receives OTP via SMS or dev console</li>
          <li>User logs in with phone + OTP</li>
          <li>If user does not exist in DB, login is rejected</li>
        </ol>
      </div>
    </div>
  );
}
