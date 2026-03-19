"use client";

import { EmailIcon, LockIcon } from "@/assets/icons8";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import InputGroup from "@/components/FormElements/InputGroup";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import React, { useState } from "react";
import { ApiError } from "@/lib/api-client";

function isValidReturnUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("/") && !url.startsWith("//");
}

export default function SigninWithPassword() {
  const { loginWithEmail } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "email") setEmail(value);
    if (name === "password") setPassword(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      const target = isValidReturnUrl(returnUrl ?? "") ? (returnUrl ?? "/") : "/";
      router.replace(target);
    } catch (err) {
      if (err instanceof ApiError && err.code === "USER_NOT_FOUND") {
        router.replace(`/auth/sign-up?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      setError(err instanceof Error ? err.message : t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Sign in with email and password">
      <InputGroup
        type="email"
        label="Email"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="Enter your email"
        name="email"
        handleChange={handleChange}
        value={email}
        icon={<EmailIcon />}
        error={error ?? undefined}
        required
        aria-label="Email address"
      />
      <InputGroup
        type="password"
        label="Password"
        className="mb-5 [&_input]:py-[15px]"
        placeholder="Enter your password"
        name="password"
        handleChange={handleChange}
        value={password}
        icon={<LockIcon />}
        showPasswordToggle
        required
        aria-label="Password"
      />
      <div className="mb-6 flex items-center justify-end gap-2 py-2 font-medium">
        <Link
          href="/auth/forgot-password"
          className="hover:text-primary dark:text-white dark:hover:text-primary"
        >
          Forgot Password?
        </Link>
      </div>
      <div className="mb-4.5">
        <button
          type="submit"
          disabled={loading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-dark-2"
          aria-busy={loading}
        >
          Sign In
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
          )}
        </button>
      </div>
    </form>
  );
}
