"use client";

import { AuthGuard } from "@/components/Auth/AuthGuard";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OnboardingWizard } from "@/components/Onboarding/OnboardingWizard";
import { OnboardingAIChat } from "@/components/Onboarding/OnboardingAIChat";
import { useAuth } from "@/contexts/auth-context";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import React, { useState, useEffect } from "react";

export default function OnboardingPage() {
  const { businessId, businesses, isLoading } = useAuth();
  const { isComplete, update } = useOnboarding(businessId);
  const router = useRouter();
  const [skipping, setSkipping] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<
    Partial<{
      businessName: string;
      businessType: string;
      country: string;
      currency: string;
      taxRegime: string;
    }>
  >({});

  const handleComplete = () => {
    router.replace("/");
  };

  useEffect(() => {
    if (!isLoading && businessId && isComplete) {
      router.replace("/");
    }
  // router excluded — not stable in Next.js App Router
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, businessId, isComplete]);

  const handleApplySuggestion = (s: Partial<{
    businessName?: string;
    businessType?: string;
    country?: string;
    currency?: string;
    taxRegime?: string;
  }>) => {
    setAppliedSuggestions((prev) => ({ ...prev, ...s }));
  };

  const handleSkipSetup = async () => {
    if (!businessId) return;
    setSkipping(true);
    try {
      await update({ onboardingComplete: true });
      router.replace("/");
    } catch {
      setSkipping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-2 dark:bg-[#020d1a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!businessId || businesses.length === 0) {
    // Don't call router.replace during render — use useEffect
    return null;
  }

  return (
    <>
    <AuthGuard>
      <div className="min-h-screen bg-gray-2 dark:bg-[#020d1a]">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stroke bg-white/95 px-4 py-3 backdrop-blur dark:border-dark-3 dark:bg-[#020d1a]/95 md:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-dark hover:text-primary dark:text-white dark:hover:text-primary"
            aria-label="Go to dashboard"
          >
            <Image
              src="/images/logo/logo-icon.svg"
              width={28}
              height={28}
              alt=""
              role="presentation"
            />
            <span className="font-semibold">Kaba</span>
          </Link>
          <button
            type="button"
            onClick={handleSkipSetup}
            disabled={skipping}
            className="rounded-lg border border-stroke px-4 py-2 text-body-sm font-medium text-dark transition hover:bg-gray-2 hover:border-primary dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 dark:hover:border-primary disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-[#020d1a]"
          >
            {skipping ? "Skipping…" : "Skip setup"}
          </button>
        </header>
        <div className="mx-auto flex min-h-[calc(100vh-60px)] max-w-4xl flex-col gap-6 p-4 md:flex-row md:items-start md:justify-center md:p-8">
          <div className="flex-1 pt-8 md:pt-16">
            <h1 className="mb-2 text-2xl font-bold text-dark dark:text-white">
              Welcome to Kaba
            </h1>
            <p className="mb-8 text-body-sm text-dark-6 dark:text-dark-6">
              Let&apos;s set up your business in a few steps.
            </p>
            <OnboardingWizard
              businessId={businessId}
              onComplete={handleComplete}
              appliedSuggestions={appliedSuggestions}
            />
          </div>
          <div className="shrink-0 md:sticky md:top-8">
            <OnboardingAIChat
              businessId={businessId}
              onApplySuggestion={handleApplySuggestion}
              collapsed={false}
            />
          </div>
        </div>
      </div>
    </AuthGuard>
    <OfflineBanner />
    </>
  );
}
