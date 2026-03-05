"use client";

import { PhoneIcon, PasswordIcon } from "@/assets/icons";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import InputGroup from "@/components/FormElements/InputGroup";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useRef, useEffect } from "react";

function isValidReturnUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("/") && !url.startsWith("//");
}

export default function SigninWithPhone() {
  const { sendOtp, sendVoiceOtp, login } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");
  const [step, setStep] = useState<"phone" | "otp" | "password">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "phone") phoneInputRef.current?.focus();
    else otpInputRef.current?.focus();
  }, [step]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await sendOtp(phone);
      setOtpMessage(res.message);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(phone, otp);
      const target = isValidReturnUrl(returnUrl ?? "") ? (returnUrl ?? "/") : "/";
      router.replace(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(phone, undefined, password);
      const target = isValidReturnUrl(returnUrl ?? "") ? (returnUrl ?? "/") : "/";
      router.replace(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "phone") setPhone(value);
    if (name === "otp") setOtp(value);
    if (name === "password") setPassword(value);
  };

  if (step === "password") {
    return (
      <form onSubmit={handleLoginWithPassword} aria-label="Sign in with password">
        <InputGroup
          type="password"
          label="Password"
          className="mb-4 [&_input]:py-[15px]"
          placeholder="Enter your password"
          name="password"
          handleChange={handleChange}
          value={password}
          icon={<PasswordIcon />}
          error={error ?? undefined}
          required
          aria-label="Password"
        />
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => { setStep("phone"); setError(null); }}
            className="rounded-lg border border-stroke px-4 py-3 font-medium text-dark dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-70"
          >
            Sign In
            {loading && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
            )}
          </button>
        </div>
      </form>
    );
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleLogin} aria-label="Enter verification code">
        {otpMessage && (
          <p className="mb-4 text-body-sm text-dark-4 dark:text-dark-6" id="otp-message">
            {otpMessage}
          </p>
        )}
        <InputGroup
          type="text"
          label="Verification code"
          className="mb-4 [&_input]:py-[15px]"
          placeholder="Enter OTP"
          name="otp"
          handleChange={handleChange}
          value={otp}
          icon={<PasswordIcon />}
          error={error ?? undefined}
          required
          aria-label="One-time verification code"
          inputRef={otpInputRef}
          showTts
        />
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setStep("phone")}
            className="rounded-lg border border-stroke px-4 py-3 font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            aria-label="Back to phone number"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-dark-2"
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

  return (
    <form onSubmit={handleSendOtp} aria-label="Sign in with phone number">
      <InputGroup
        type="tel"
        label="Phone number"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="e.g. +2348012345678"
        name="phone"
        handleChange={handleChange}
        value={phone}
        icon={<PhoneIcon />}
        error={error ?? undefined}
        required
        aria-label="Phone number for OTP"
        inputRef={phoneInputRef}
        showTts
      />
      <div className="mb-4.5 flex flex-col gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-dark-2"
          aria-busy={loading}
        >
          Send OTP
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
          )}
        </button>
        <button
          type="button"
          onClick={() => { setStep("password"); setError(null); }}
          disabled={!phone?.trim()}
          className="rounded-lg border border-stroke px-4 py-3 font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 disabled:opacity-50"
        >
          I have a password
        </button>
        <button
          type="button"
          onClick={async () => {
            setError(null);
            setLoading(true);
            try {
              const res = await sendVoiceOtp(phone, locale === "fr" ? "fr" : "en");
              setOtpMessage(res.message);
              setStep("otp");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to initiate call");
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading || !phone?.trim()}
          className="rounded-lg border border-stroke px-4 py-3 font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label="Receive code by phone call instead"
        >
          Call me with code
        </button>
      </div>
    </form>
  );
}
