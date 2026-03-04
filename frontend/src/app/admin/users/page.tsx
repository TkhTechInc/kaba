"use client";

import { useAuth } from "@/contexts/auth-context";
import { createAdminApi } from "@/services/admin.service";
import { useState } from "react";

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">
        Create Phone User
      </h1>
      <p className="mb-4 text-sm text-dark-6 dark:text-dark-6">
        Users must be created before they can log in with phone + OTP. Add a phone number to grant access.
      </p>

      <form
        onSubmit={handleCreate}
        className="mb-6 max-w-md rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark"
      >
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

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
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
