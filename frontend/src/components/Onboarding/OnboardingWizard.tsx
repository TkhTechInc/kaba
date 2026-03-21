"use client";

import { useOnboarding } from "@/hooks/use-onboarding";
import { useLocale } from "@/contexts/locale-context";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useOnboardingForm } from "./hooks/useOnboardingForm";
import { BusinessInfoStep } from "./steps/BusinessInfoStep";
import { LocationStep } from "./steps/LocationStep";
import { TaxLegalStep } from "./steps/TaxLegalStep";
import { AdditionalDetailsStep } from "./steps/AdditionalDetailsStep";

type WizardStep = 1 | 2 | 3 | 4;

export function OnboardingWizard({
  businessId,
  onComplete,
  appliedSuggestions,
}: {
  businessId: string;
  onComplete: () => void;
  appliedSuggestions?: Partial<{
    businessName: string;
    businessType: string;
    country: string;
    currency: string;
    taxRegime: string;
    taxId: string;
    businessAddress: string;
    businessPhone: string;
    fiscalYearStart: number;
  }>;
}) {
  const { t } = useLocale();
  const { data, update, loading } = useOnboarding(businessId);
  const [step, setStep] = useState<WizardStep>(1);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  const STEPS = [
    { id: 1, key: "business", title: t("onboarding.steps.business") },
    { id: 2, key: "location", title: t("onboarding.steps.location") },
    { id: 3, key: "tax", title: t("onboarding.steps.tax") },
    { id: 4, key: "details", title: t("onboarding.steps.details") },
  ];

  const initialData = data?.answers ? {
    businessName: data.answers.businessName ?? "",
    businessType: data.answers.businessType ?? "",
    slug: data.answers.slug ?? "",
    description: data.answers.description ?? "",
    country: data.answers.country ?? "",
    currency: data.answers.currency ?? "",
    taxRegime: data.answers.taxRegime ?? "",
    taxId: data.answers.taxId ?? "",
    legalStatus: data.answers.legalStatus ?? "",
    rccm: data.answers.rccm ?? "",
    businessAddress: data.answers.businessAddress ?? "",
    businessPhone: data.answers.businessPhone ?? "",
    fiscalYearStart: data.answers.fiscalYearStart != null ? String(data.answers.fiscalYearStart) : "",
  } : undefined;

  const { formData, handlers } = useOnboardingForm({ initialData, appliedSuggestions });

  useEffect(() => {
    firstInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!appliedSuggestions) return;
    const hasStep1 = appliedSuggestions.businessName != null || appliedSuggestions.businessType != null;
    const hasStep2 = appliedSuggestions.country != null || appliedSuggestions.currency != null;
    const hasStep3 = appliedSuggestions.taxRegime != null;
    const hasStep4 = appliedSuggestions.businessAddress != null || appliedSuggestions.businessPhone != null || appliedSuggestions.fiscalYearStart != null;

    if (hasStep4) setStep(4);
    else if (hasStep3) setStep(3);
    else if (hasStep2) setStep(2);
    else if (hasStep1) setStep(1);
  }, [appliedSuggestions]);

  const saveAndNext = async () => {
    setError(null);
    try {
      if (step === 1) {
        await update({
          businessName: formData.businessName,
          businessType: formData.businessType,
          slug: formData.slug || undefined,
          description: formData.description || undefined
        });
        setStep(2);
      } else if (step === 2) {
        await update({ country: formData.country, currency: formData.currency });
        setStep(3);
      } else if (step === 3) {
        await update({
          taxRegime: formData.taxRegime || undefined,
          taxId: formData.taxId || undefined,
          legalStatus: formData.legalStatus || undefined,
          rccm: formData.rccm || undefined,
        });
        setStep(4);
      } else if (step === 4) {
        await update({
          businessAddress: formData.businessAddress || undefined,
          businessPhone: formData.businessPhone || undefined,
          fiscalYearStart: formData.fiscalYearStart ? parseInt(formData.fiscalYearStart, 10) : undefined,
          onboardingComplete: true,
        });
        onComplete();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("onboarding.error"));
    }
  };

  const handleSkip = async () => {
    setError(null);
    try {
      if (step === 3) {
        await update({
          taxRegime: formData.taxRegime || undefined,
          taxId: formData.taxId || undefined,
          legalStatus: formData.legalStatus || undefined,
          rccm: formData.rccm || undefined,
          onboardingComplete: true,
        });
        onComplete();
      }
      if (step === 4) {
        await update({ onboardingComplete: true });
        onComplete();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("onboarding.error"));
    }
  };

  const canProceed =
    step === 1
      ? formData.businessName.trim().length > 0 && formData.businessType
      : step === 2
        ? formData.country
        : true;

  return (
    <div className="w-full max-w-lg" role="region" aria-label={t("onboarding.aria.wizard")}>
      <div className="mb-8 flex gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={4} aria-label={t("onboarding.aria.stepOf", { step })}>
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              step >= s.id ? "bg-primary" : "bg-stroke dark:bg-dark-3"
            )}
          />
        ))}
      </div>

      <h2 id="onboarding-step-title" className="mb-6 text-xl font-semibold text-dark dark:text-white">
        {step === 1 && t("onboarding.stepTitles.business")}
        {step === 2 && t("onboarding.stepTitles.location")}
        {step === 3 && t("onboarding.stepTitles.tax")}
        {step === 4 && t("onboarding.stepTitles.details")}
      </h2>

      {step === 1 && (
        <BusinessInfoStep
          businessName={formData.businessName}
          businessType={formData.businessType}
          slug={formData.slug}
          description={formData.description}
          handleChange={handlers.handleChange}
          error={error}
          inputRef={firstInputRef as React.RefObject<HTMLInputElement | null>}
        />
      )}

      {step === 2 && (
        <LocationStep
          country={formData.country}
          handleChange={handlers.handleChange}
          inputRef={firstInputRef as React.RefObject<HTMLSelectElement>}
        />
      )}

      {step === 3 && (
        <TaxLegalStep
          country={formData.country}
          legalStatus={formData.legalStatus}
          rccm={formData.rccm}
          taxRegime={formData.taxRegime}
          taxId={formData.taxId}
          handleChange={handlers.handleChange}
          inputRef={firstInputRef as React.RefObject<HTMLSelectElement>}
        />
      )}

      {step === 4 && (
        <AdditionalDetailsStep
          businessAddress={formData.businessAddress}
          businessPhone={formData.businessPhone}
          fiscalYearStart={formData.fiscalYearStart}
          handleChange={handlers.handleChange}
          inputRef={firstInputRef as React.RefObject<HTMLInputElement | null>}
        />
      )}

      {error && (
        <p className="mt-4 text-body-sm text-red" role="alert">{error}</p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1) as WizardStep)}
            className="inline-flex items-center gap-2.5 rounded-lg border border-stroke px-6 py-[11px] font-medium text-dark transition hover:bg-gray-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            disabled={loading}
          >
            {t("onboarding.back")}
          </button>
        )}

        <button
          type="button"
          onClick={saveAndNext}
          disabled={!canProceed || loading}
          className="inline-flex items-center gap-2.5 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t("onboarding.saving") : step === 4 ? t("onboarding.finish") : t("onboarding.continue")}
        </button>

        {(step === 3 || step === 4) && (
          <button
            type="button"
            onClick={handleSkip}
            className="text-body-sm font-medium text-dark-4 underline transition hover:text-dark dark:text-dark-6 dark:hover:text-white"
            disabled={loading}
          >
            {t("onboarding.skipAndFinish")}
          </button>
        )}
      </div>
    </div>
  );
}
