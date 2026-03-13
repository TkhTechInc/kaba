"use client";

import { EmailIcon, LockIcon } from "@/assets/icons8";
import { useAuth } from "@/contexts/auth-context";
import InputGroup from "@/components/FormElements/InputGroup";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useRef, useEffect } from "react";

function friendlyError(raw: string): { message: string; suggestion?: React.ReactNode } {
  const lower = raw.toLowerCase();

  if (lower.includes("already exists") || lower.includes("conflict") || lower.includes("409")) {
    return {
      message: "An account with this email already exists.",
      suggestion: (
        <>
          <Link href="/auth/sign-in" className="font-medium text-primary underline underline-offset-2">
            Sign in instead
          </Link>{" "}
          or use a different email address.
        </>
      ),
    };
  }
  if (lower.includes("invalid or expired") && lower.includes("code")) {
    return {
      message: "The verification code is incorrect or has expired.",
      suggestion: "Double-check the code in your inbox, or go back and request a new one.",
    };
  }
  if (lower.includes("expired")) {
    return { message: "The verification code has expired.", suggestion: "Go back and request a new code." };
  }
  if (lower.includes("password") && lower.includes("8")) {
    return { message: "Your password must be at least 8 characters long." };
  }
  if (lower.includes("passwords do not match")) {
    return { message: "The passwords you entered don't match. Please try again." };
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch")) {
    return { message: "Unable to reach the server. Please check your connection and try again." };
  }
  if (lower.includes("email") && lower.includes("required")) {
    return { message: "Please enter your email address." };
  }

  // Fall back to the raw message but capitalise it nicely
  return { message: raw.charAt(0).toUpperCase() + raw.slice(1) };
}

interface AlertProps {
  message: string;
  suggestion?: React.ReactNode;
}

function ErrorAlert({ message, suggestion }: AlertProps) {
  return (
    <div
      role="alert"
      className="mb-5 flex flex-col gap-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
    >
      <p className="font-medium">{message}</p>
      {suggestion && <p className="text-red-600 dark:text-red-400/80">{suggestion}</p>}
    </div>
  );
}

export default function SignUpForm() {
  const { signUpRequest, signUpVerify } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "verify">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; suggestion?: React.ReactNode } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "verify") codeInputRef.current?.focus();
  }, [step]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "email") setEmail(value);
    if (name === "code") setCode(value);
    if (name === "password") setPassword(value);
    if (name === "confirmPassword") setConfirmPassword(value);
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signUpRequest(email);
      setSuccessMessage(res.message);
      setStep("verify");
    } catch (err) {
      const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to send verification code";
      setError(friendlyError(typeof raw === "string" ? raw : "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(friendlyError("passwords do not match"));
      return;
    }
    if (password.length < 8) {
      setError(friendlyError("password must be at least 8 characters"));
      return;
    }

    setLoading(true);
    try {
      await signUpVerify(email, code, password);
      router.replace("/onboarding");
    } catch (err) {
      const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "Verification failed. Please try again.";
      setError(friendlyError(typeof raw === "string" ? raw : "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (step === "verify") {
    return (
      <form onSubmit={handleVerifyAndCreate} aria-label="Verify email and create account">
        {successMessage && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-400">
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p>{successMessage}</p>
          </div>
        )}

        {error && <ErrorAlert message={error.message} suggestion={error.suggestion} />}

        <InputGroup
          type="text"
          label="Verification code"
          className="mb-4 [&_input]:py-[15px]"
          placeholder="Enter the 6-digit code from your email"
          name="code"
          handleChange={handleChange}
          value={code}
          icon={<LockIcon />}
          required
          aria-label="Verification code"
          inputRef={codeInputRef}
        />
        <InputGroup
          type="password"
          label="Password"
          className="mb-4 [&_input]:py-[15px]"
          placeholder="At least 8 characters"
          name="password"
          handleChange={handleChange}
          value={password}
          icon={<LockIcon />}
          required
          aria-label="Password"
        />
        <InputGroup
          type="password"
          label="Confirm password"
          className="mb-4 [&_input]:py-[15px]"
          placeholder="Re-enter your password"
          name="confirmPassword"
          handleChange={handleChange}
          value={confirmPassword}
          icon={<LockIcon />}
          required
          aria-label="Confirm password"
        />

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
              setSuccessMessage(null);
            }}
            className="rounded-lg border border-stroke px-4 py-3 font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-dark-2"
            aria-busy={loading}
          >
            {loading ? "Creating account…" : "Verify & create account"}
            {loading && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
            )}
          </button>
        </div>

        <p className="text-center text-sm text-dark-4 dark:text-dark-6">
          Didn&apos;t receive the code?{" "}
          <button
            type="button"
            onClick={() => { setStep("email"); setCode(""); setError(null); setSuccessMessage(null); }}
            className="font-medium text-primary underline underline-offset-2"
          >
            Resend
          </button>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequestCode} aria-label="Request verification code">
      {error && <ErrorAlert message={error.message} suggestion={error.suggestion} />}

      <InputGroup
        type="email"
        label="Email"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="Enter your email address"
        name="email"
        handleChange={handleChange}
        value={email}
        icon={<EmailIcon />}
        required
        aria-label="Email address"
      />
      <p className="mb-4 text-body-sm text-dark-4 dark:text-dark-6">
        We&apos;ll send a 6-digit verification code to your email. You&apos;ll set your password after confirming.
      </p>
      <div className="mb-4.5">
        <button
          type="submit"
          disabled={loading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-dark-2"
          aria-busy={loading}
        >
          {loading ? "Sending code…" : "Send verification code"}
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
          )}
        </button>
      </div>
    </form>
  );
}
