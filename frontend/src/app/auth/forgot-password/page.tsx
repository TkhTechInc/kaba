"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { apiPost } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email?.trim()) {
      setError("Email is required");
      return;
    }
    setLoading(true);
    try {
      await apiPost<{ success: boolean; message: string }>(
        "/api/v1/auth/forgot-password",
        { email: email.trim() },
        { skip401Redirect: true }
      );
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-md rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Link href="/" className="flex items-center justify-center">
            <Logo />
          </Link>
          <h1 className="text-xl font-bold text-dark dark:text-white">
            Check your email
          </h1>
          <p className="text-center text-body-sm text-dark-4 dark:text-dark-6">
            If an account exists with that email, you will receive a password
            reset link shortly. The link expires in 1 hour.
          </p>
        </div>

        <div className="flex flex-col gap-4 text-center">
          <Link
            href="/auth/sign-in"
            className="inline-block rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90"
          >
            Back to Sign In
          </Link>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setEmail("");
            }}
            className="text-body-sm text-primary underline"
          >
            Try another email
          </button>
        </div>
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
          Forgot password
        </h1>
        <p className="text-center text-body-sm text-dark-4 dark:text-dark-6">
          Enter your email and we&apos;ll send you a link to reset your password.
          Works for both email and Google sign-in accounts.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="email" className="mb-1 block text-body-sm font-medium text-dark dark:text-white">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-dark dark:border-gray-700 dark:bg-gray-dark dark:text-white"
            autoComplete="email"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send reset link"}
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
