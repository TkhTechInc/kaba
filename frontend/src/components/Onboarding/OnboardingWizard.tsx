"use client";

import { useOnboarding } from "@/hooks/use-onboarding";
import InputGroup from "@/components/FormElements/InputGroup";
import { cn } from "@/lib/utils";
import React, { useState, useRef, useEffect } from "react";

const BUSINESS_TYPES = [
  { value: "retail", label: "Retail / Shop" },
  { value: "restaurant", label: "Restaurant / Food" },
  { value: "services", label: "Services" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "agriculture", label: "Agriculture" },
  { value: "other", label: "Other" },
];

const COUNTRIES = [
  { value: "NG", label: "Nigeria" },
  { value: "GH", label: "Ghana" },
  { value: "BJ", label: "Benin" },
  { value: "SN", label: "Senegal" },
  { value: "CI", label: "Côte d'Ivoire" },
  { value: "TG", label: "Togo" },
  { value: "CM", label: "Cameroon" },
  { value: "ML", label: "Mali" },
  { value: "NE", label: "Niger" },
  { value: "BF", label: "Burkina Faso" },
];

const CURRENCIES = [
  { value: "NGN", label: "NGN (Naira)" },
  { value: "GHS", label: "GHS (Cedi)" },
  { value: "XOF", label: "XOF (CFA Franc)" },
  { value: "XAF", label: "XAF (CFA Franc)" },
];

const TAX_REGIMES = [
  { value: "vat", label: "VAT registered" },
  { value: "simplified", label: "Simplified tax" },
  { value: "none", label: "Not registered" },
];

const STEPS = [
  { id: 1, key: "business", title: "Business" },
  { id: 2, key: "location", title: "Location" },
  { id: 3, key: "tax", title: "Tax (optional)" },
  { id: 4, key: "details", title: "Details (optional)" },
];

type WizardStep = 1 | 2 | 3 | 4;

const FISCAL_YEAR_MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export function OnboardingWizard({
  businessId,
  onComplete,
  appliedSuggestions,
}: {
  businessId: string;
  onComplete: () => void;
  /** When parent applies AI suggestions, merge into form */
  appliedSuggestions?: Partial<{
    businessName: string;
    businessType: string;
    country: string;
    currency: string;
    taxRegime: string;
    businessAddress: string;
    businessPhone: string;
    fiscalYearStart: number;
  }>;
}) {
  const { data, update, loading } = useOnboarding(businessId);
  const [step, setStep] = useState<WizardStep>(1);
  const [businessName, setBusinessName] = useState(data?.answers.businessName ?? "");
  const [businessType, setBusinessType] = useState(data?.answers.businessType ?? "");
  const [country, setCountry] = useState(data?.answers.country ?? "");
  const [currency, setCurrency] = useState(data?.answers.currency ?? "");
  const [taxRegime, setTaxRegime] = useState(data?.answers.taxRegime ?? "");
  const [businessAddress, setBusinessAddress] = useState(data?.answers.businessAddress ?? "");
  const [businessPhone, setBusinessPhone] = useState(data?.answers.businessPhone ?? "");
  const [fiscalYearStart, setFiscalYearStart] = useState(
    data?.answers.fiscalYearStart != null ? String(data.answers.fiscalYearStart) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, [step]);

  React.useEffect(() => {
    if (data?.answers) {
      setBusinessName(data.answers.businessName ?? "");
      setBusinessType(data.answers.businessType ?? "");
      setCountry(data.answers.country ?? "");
      setCurrency(data.answers.currency ?? "");
      setTaxRegime(data.answers.taxRegime ?? "");
      setBusinessAddress(data.answers.businessAddress ?? "");
      setBusinessPhone(data.answers.businessPhone ?? "");
      setFiscalYearStart(
        data.answers.fiscalYearStart != null ? String(data.answers.fiscalYearStart) : ""
      );
    }
  }, [data?.answers]);

  React.useEffect(() => {
    if (appliedSuggestions) {
      if (appliedSuggestions.businessName != null) setBusinessName(appliedSuggestions.businessName);
      if (appliedSuggestions.businessType != null) setBusinessType(appliedSuggestions.businessType);
      if (appliedSuggestions.country != null) setCountry(appliedSuggestions.country);
      if (appliedSuggestions.currency != null) setCurrency(appliedSuggestions.currency);
      if (appliedSuggestions.taxRegime != null) setTaxRegime(appliedSuggestions.taxRegime);
      if (appliedSuggestions.businessAddress != null) setBusinessAddress(appliedSuggestions.businessAddress);
      if (appliedSuggestions.businessPhone != null) setBusinessPhone(appliedSuggestions.businessPhone);
      if (appliedSuggestions.fiscalYearStart != null) setFiscalYearStart(String(appliedSuggestions.fiscalYearStart));
    }
  }, [appliedSuggestions]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "businessName") setBusinessName(value);
    if (name === "businessType") setBusinessType(value);
    if (name === "country") setCountry(value);
    if (name === "currency") setCurrency(value);
    if (name === "taxRegime") setTaxRegime(value);
    if (name === "businessAddress") setBusinessAddress(value);
    if (name === "businessPhone") setBusinessPhone(value);
    if (name === "fiscalYearStart") setFiscalYearStart(value);
  };

  const saveAndNext = async () => {
    setError(null);
    try {
      if (step === 1) {
        await update({ businessName, businessType });
        setStep(2);
      } else if (step === 2) {
        await update({ country, currency });
        setStep(3);
      } else if (step === 3) {
        await update({ taxRegime });
        setStep(4);
      } else if (step === 4) {
        await update(
          {
            businessAddress: businessAddress || undefined,
            businessPhone: businessPhone || undefined,
            fiscalYearStart: fiscalYearStart ? parseInt(fiscalYearStart, 10) : undefined,
            onboardingComplete: true,
          }
        );
        onComplete();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const handleSkip = async () => {
    setError(null);
    try {
      if (step === 3) {
        await update({ taxRegime: taxRegime || undefined, onboardingComplete: true });
        onComplete();
      }
      if (step === 4) {
        await update({ onboardingComplete: true });
        onComplete();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const canProceed =
    step === 1
      ? businessName.trim().length > 0 && businessType
      : step === 2
        ? country && currency
        : step === 3 || step === 4
          ? true
          : true;

  return (
    <div className="w-full max-w-lg" role="region" aria-label="Onboarding wizard">
      <div className="mb-8 flex gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={4} aria-label={`Step ${step} of 4`}>
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
        {step === 1 && "Tell us about your business"}
        {step === 2 && "Where do you operate?"}
        {step === 3 && "Tax registration (optional)"}
        {step === 4 && "Contact & reporting (optional)"}
      </h2>

      {step === 1 && (
        <div className="space-y-4" aria-labelledby="onboarding-step-title">
          <InputGroup
            type="text"
            label="Business name"
            name="businessName"
            placeholder="e.g. Mama's Shop"
            value={businessName}
            handleChange={handleChange}
            className="[&_input]:py-[15px]"
            error={error ?? undefined}
            inputRef={firstInputRef as React.RefObject<HTMLInputElement | null>}
          />
          <div>
            <label htmlFor="businessType" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              Business type
            </label>
            <select
              id="businessType"
              name="businessType"
              value={businessType}
              onChange={handleChange}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
              aria-label="Business type"
            >
              <option value="">Select type</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4" aria-labelledby="onboarding-step-title">
          <div>
            <label htmlFor="country" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              Country
            </label>
            <select
              id="country"
              name="country"
              value={country}
              onChange={handleChange}
              ref={firstInputRef as React.RefObject<HTMLSelectElement>}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
              aria-label="Country"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="currency" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              Currency
            </label>
            <select
              id="currency"
              name="currency"
              value={currency}
              onChange={handleChange}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
              aria-label="Currency"
            >
              <option value="">Select currency</option>
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4" aria-labelledby="onboarding-step-title">
          <div>
            <label htmlFor="taxRegime" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              Tax regime
            </label>
            <select
              id="taxRegime"
              name="taxRegime"
              value={taxRegime}
              onChange={handleChange}
              ref={firstInputRef as React.RefObject<HTMLSelectElement>}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
              aria-label="Tax regime (optional)"
            >
              <option value="">Select (optional)</option>
              {TAX_REGIMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4" aria-labelledby="onboarding-step-title">
          <InputGroup
            type="text"
            label="Business address"
            name="businessAddress"
            placeholder="e.g. 123 Main St, Lagos"
            value={businessAddress}
            handleChange={handleChange}
            className="[&_input]:py-[15px]"
            inputRef={firstInputRef as React.RefObject<HTMLInputElement | null>}
          />
          <InputGroup
            type="text"
            label="Business phone"
            name="businessPhone"
            placeholder="e.g. +234 800 000 0000"
            value={businessPhone}
            handleChange={handleChange}
            className="[&_input]:py-[15px]"
          />
          <div>
            <label htmlFor="fiscalYearStart" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              Fiscal year start month
            </label>
            <select
              id="fiscalYearStart"
              name="fiscalYearStart"
              value={fiscalYearStart}
              onChange={handleChange}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
              aria-label="Fiscal year start (optional)"
            >
              <option value="">Select (optional)</option>
              {FISCAL_YEAR_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 text-body-sm text-red" role="alert">{error}</p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={saveAndNext}
          disabled={loading || (step < 4 && !canProceed)}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-dark-2"
          aria-busy={loading}
        >
          {step < 4 ? "Next" : "Complete"}
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
          )}
        </button>
        {(step === 3 || step === 4) && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="rounded-lg border border-stroke px-6 py-3 font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-dark-2"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
