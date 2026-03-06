"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { apiPost } from "@/lib/api-client";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing reset token. Please use the link from your email.");
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Missing reset token. Please use the link from your email.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await apiPost<{ success: boolean; message: string }>(
        "/api/v1/auth/reset-password",
        { token, password },
        { skip401Redirect: true }
      );
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Link href="/" className="flex items-center justify-center">
            <Logo />
          </Link>
          <h1 className="text-xl font-bold text-dark dark:text-white">
            Password reset
          </h1>
          <p className="text-center text-body-sm text-dark-4 dark:text-dark-6">
            Your password has been reset. You can now sign in with your email
            and password.
          </p>
        </div>

        <Link
          href="/auth/sign-in"
          className="block rounded-lg bg-primary px-6 py-3 text-center font-medium text-white transition hover:bg-opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
      <div className="mb-8 flex flex-col items-center gap-4">
        <Link href="/" className="flex items-center justify-center">
          <Logo />
        </Link>
        <h1 className="text-xl font-bold text-dark dark:text-white">
          Set new password
        </h1>
        <p className="text-center text-body-sm text-dark-4 dark:text-dark-6">
          Enter your new password below. It must be at least 8 characters.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="password" className="mb-1 block text-body-sm font-medium text-dark dark:text-white">
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-dark dark:border-gray-700 dark:bg-gray-dark dark:text-white"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-body-sm font-medium text-dark dark:text-white">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-dark dark:border-gray-700 dark:bg-gray-dark dark:text-white"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading || !token}
          className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
        >
          {loading ? "Resetting…" : "Reset password"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/auth/sign-in"
          className="text-body-sm text-primary underline"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
