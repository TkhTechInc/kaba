"use client";

import { useAuth } from "@/contexts/auth-context";
import { apiGet, apiPost } from "@/lib/api-client";
import { Logo } from "@/components/logo";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function isEmail(s: string): boolean {
  return s.includes("@");
}

function InviteContent() {
  const {
    token,
    isLoading,
    refreshBusinesses,
    inviteRequestOtp,
    inviteVerify,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token");

  const [inviteData, setInviteData] = useState<{
    emailOrPhone: string;
    businessName: string;
    role: string;
  } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(true);

  const [step, setStep] = useState<"request" | "verify">("request");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch invitation by token when not logged in
  useEffect(() => {
    if (!tokenParam?.trim()) {
      setInviteLoading(false);
      return;
    }
    if (token) {
      setInviteLoading(false);
      return;
    }
    apiGet<{ success: boolean; data: { emailOrPhone: string; businessName: string; role: string } | null }>(
      `/api/v1/invitations/by-token?token=${encodeURIComponent(tokenParam)}`,
      { skip401Redirect: true }
    )
      .then((res) => {
        if (res.success && res.data) {
          setInviteData(res.data);
        } else {
          setInviteData(null);
        }
      })
      .catch(() => setInviteData(null))
      .finally(() => setInviteLoading(false));
  }, [tokenParam, token]);

  const handleRequestOtp = async () => {
    if (!tokenParam || !inviteData) return;
    setError(null);
    setRequesting(true);
    try {
      await inviteRequestOtp(tokenParam);
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code");
    } finally {
      setRequesting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenParam || !inviteData) return;
    if (!code.trim() || !password.trim()) {
      setError("Enter verification code and password");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      await inviteVerify(tokenParam, inviteData.emailOrPhone, code.trim(), password);
      await refreshBusinesses();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate account");
    } finally {
      setVerifying(false);
    }
  };

  const handleAccept = async () => {
    if (!tokenParam || !token) return;
    setError(null);
    setAccepting(true);
    try {
      await apiPost<{ success: boolean }>(
        "/api/v1/invitations/accept",
        { token: tokenParam },
        { token }
      );
      await refreshBusinesses();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    setDeclining(true);
    router.replace("/");
  };

  const handleSignInToAccept = () => {
    const returnUrl = `/invite?token=${encodeURIComponent(tokenParam ?? "")}`;
    router.replace(`/auth/sign-in?returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  // No token in URL
  if (!tokenParam?.trim()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-2 px-4 dark:bg-[#020d1a]">
        <div className="w-full max-w-md rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
          <div className="mb-8 flex flex-col items-center gap-4">
            <Link href="/" className="flex items-center justify-center">
              <Logo />
            </Link>
            <h1 className="text-xl font-bold text-dark dark:text-white">
              Invalid invitation
            </h1>
            <p className="text-center text-body-sm text-dark-4 dark:text-dark-6">
              This invitation link is invalid or missing a token. Please check the
              link and try again.
            </p>
          </div>
          <Link
            href="/"
            className="block w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-white hover:bg-primary/90"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading || (inviteLoading && !token)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-2 dark:bg-[#020d1a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-dark-4 dark:text-dark-6">Loading...</p>
      </div>
    );
  }

  // Logged in: show accept/decline
  if (token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-2 px-4 dark:bg-[#020d1a]">
        <div className="w-full max-w-md rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
          <div className="mb-8 flex flex-col items-center gap-4">
            <Link href="/" className="flex items-center justify-center">
              <Logo />
            </Link>
            <h1 className="text-xl font-bold text-dark dark:text-white">
              Accept invitation
            </h1>
            <p className="text-center text-body-sm text-dark-4 dark:text-dark-6">
              You&apos;ve been invited to join a business. Accept to get access.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleAccept}
              disabled={accepting}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-70"
            >
              {accepting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Accepting...
                </span>
              ) : (
                "Accept"
              )}
            </button>
            <button
              type="button"
              onClick={handleDecline}
              disabled={declining}
              className="w-full rounded-lg border border-stroke px-4 py-3 font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 disabled:opacity-70"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in, invalid or expired invitation
  if (!inviteData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-2 px-4 dark:bg-[#020d1a]">
        <div className="w-full max-w-md rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
          <div className="mb-8 flex flex-col items-center gap-4">
            <Link href="/" className="flex items-center justify-center">
              <Logo />
            </Link>
            <h1 className="text-xl font-bold text-dark dark:text-white">
              Invalid or expired invitation
            </h1>
            <p className="text-center text-body-sm text-dark-4 dark:text-dark-6">
              This invitation link is invalid or has expired. Please ask for a new
              invitation.
            </p>
          </div>
          <Link
            href="/"
            className="block w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-white hover:bg-primary/90"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Not logged in, valid invitation: show activate form or sign-in option
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-2 px-4 dark:bg-[#020d1a]">
      <div className="w-full max-w-md rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
        <div className="mb-6 flex flex-col items-center gap-4">
          <Link href="/" className="flex items-center justify-center">
            <Logo />
          </Link>
          <h1 className="text-xl font-bold text-dark dark:text-white">
            Join {inviteData.businessName}
          </h1>
          <p className="text-center text-body-sm text-dark-4 dark:text-dark-6">
            You&apos;ve been invited as {inviteData.role}. Create an account to accept.
          </p>
        </div>

        <p className="mb-4 text-sm text-dark-4 dark:text-dark-6">
          {isEmail(inviteData.emailOrPhone) ? "Email" : "Phone"}:{" "}
          <span className="font-medium text-dark dark:text-white">
            {inviteData.emailOrPhone}
          </span>
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {step === "request" ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={requesting}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-70"
            >
              {requesting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </span>
              ) : (
                "Send verification code"
              )}
            </button>
            <button
              type="button"
              onClick={handleSignInToAccept}
              className="w-full rounded-lg border border-stroke px-4 py-3 font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              I already have an account — sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="code"
                className="mb-1 block text-sm font-medium text-dark dark:text-white"
              >
                Verification code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-dark dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-dark dark:text-white"
              >
                Password (min 8 characters)
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-dark dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={verifying}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-70"
            >
              {verifying ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Activating...
                </span>
              ) : (
                "Activate account"
              )}
            </button>
            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={requesting}
              className="text-sm text-dark-4 hover:text-primary dark:text-dark-6 dark:hover:text-primary disabled:opacity-50"
            >
              Resend code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-2 dark:bg-[#020d1a]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-dark-4 dark:text-dark-6">Loading...</p>
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}
