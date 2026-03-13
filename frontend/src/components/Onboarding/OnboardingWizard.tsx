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

const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  NG: "NGN",
  GH: "GHS",
  BJ: "XOF",
  SN: "XOF",
  CI: "XOF",
  TG: "XOF",
  ML: "XOF",
  NE: "XOF",
  BF: "XOF",
  CM: "XAF",
};

const TAX_REGIMES = [
  { value: "vat", label: "VAT registered" },
  { value: "simplified", label: "Simplified tax" },
  { value: "none", label: "Not registered" },
];

const STEPS = [
  { id: 1, key: "business", title: "Business" },
  { id: 2, key: "location", title: "Location" },
  { id: 3, key: "tax", title: "Fiscal (optional)" },
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
    taxId: string;
    businessAddress: string;
    businessPhone: string;
    fiscalYearStart: number;
  }>;
}) {
  const { data, update, loading } = useOnboarding(businessId);
  const [step, setStep] = useState<WizardStep>(1);
  const [businessName, setBusinessName] = useState(data?.answers.businessName ?? "");
  const [businessType, setBusinessType] = useState(data?.answers.businessType ?? "");
  const [slug, setSlug] = useState(data?.answers.slug ?? "");
  const [description, setDescription] = useState(data?.answers.description ?? "");
  const [country, setCountry] = useState(data?.answers.country ?? "");
  const [currency, setCurrency] = useState(data?.answers.currency ?? "");
  const [taxRegime, setTaxRegime] = useState(data?.answers.taxRegime ?? "");
  const [taxId, setTaxId] = useState(data?.answers.taxId ?? "");
  const [legalStatus, setLegalStatus] = useState(data?.answers.legalStatus ?? "");
  const [rccm, setRccm] = useState(data?.answers.rccm ?? "");
  const [businessAddress, setBusinessAddress] = useState(data?.answers.businessAddress ?? "");
  const [businessPhone, setBusinessPhone] = useState(data?.answers.businessPhone ?? "");
  const [fiscalYearStart, setFiscalYearStart] = useState(
    data?.answers.fiscalYearStart != null ? String(data.answers.fiscalYearStart) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  /** Countries where a government-issued tax ID (IFU/NCC) is required for e-invoicing */
  const FISCAL_ID_COUNTRIES: Record<string, { label: string; placeholder: string; hint: string }> = {
    BJ: {
      label: "IFU (Identifiant Fiscal Unique)",
      placeholder: "e.g. 0202376693109",
      hint: "Your 13-digit Benin tax ID. Required for DGI e-MECeF invoice certification.",
    },
    CI: {
      label: "NCC (Numéro de Compte Contribuable)",
      placeholder: "e.g. 1234567A",
      hint: "Your Côte d'Ivoire taxpayer account number. Required for FNE e-invoicing.",
    },
  };

  useEffect(() => {
    firstInputRef.current?.focus();
  }, [step]);

  React.useEffect(() => {
    if (data?.answers) {
      setBusinessName(data.answers.businessName ?? "");
      setBusinessType(data.answers.businessType ?? "");
      setSlug(data.answers.slug ?? "");
      setDescription(data.answers.description ?? "");
      setCountry(data.answers.country ?? "");
      // Currency is always derived from country; never allow divergence
      const answersCountry = data.answers.country ?? "";
      const derivedCurrency = answersCountry ? (COUNTRY_DEFAULT_CURRENCY[answersCountry] ?? "XOF") : (data.answers.currency ?? "");
      setCurrency(derivedCurrency);
      setTaxRegime(data.answers.taxRegime ?? "");
      setTaxId(data.answers.taxId ?? "");
      setLegalStatus(data.answers.legalStatus ?? "");
      setRccm(data.answers.rccm ?? "");
      setBusinessAddress(data.answers.businessAddress ?? "");
      setBusinessPhone(data.answers.businessPhone ?? "");
      setFiscalYearStart(
        data.answers.fiscalYearStart != null ? String(data.answers.fiscalYearStart) : ""
      );
    }
  }, [data?.answers]);

  React.useEffect(() => {
    if (!appliedSuggestions) return;
    if (appliedSuggestions.businessName != null) setBusinessName(appliedSuggestions.businessName);
    if (appliedSuggestions.businessType != null) setBusinessType(appliedSuggestions.businessType);
    if (appliedSuggestions.country != null) {
      setCountry(appliedSuggestions.country);
      setCurrency(COUNTRY_DEFAULT_CURRENCY[appliedSuggestions.country] ?? "XOF");
    }
    if (appliedSuggestions.taxRegime != null) setTaxRegime(appliedSuggestions.taxRegime);
    if (appliedSuggestions.taxId != null) setTaxId(appliedSuggestions.taxId);
    if (appliedSuggestions.businessAddress != null) setBusinessAddress(appliedSuggestions.businessAddress);
    if (appliedSuggestions.businessPhone != null) setBusinessPhone(appliedSuggestions.businessPhone);
    if (appliedSuggestions.fiscalYearStart != null) setFiscalYearStart(String(appliedSuggestions.fiscalYearStart));

    // Jump to the step that contains the suggested field so the user sees it filled in
    const hasStep1 = appliedSuggestions.businessName != null || appliedSuggestions.businessType != null;
    const hasStep2 = appliedSuggestions.country != null || appliedSuggestions.currency != null;
    const hasStep3 = appliedSuggestions.taxRegime != null;
    const hasStep4 = appliedSuggestions.businessAddress != null || appliedSuggestions.businessPhone != null || appliedSuggestions.fiscalYearStart != null;

    if (hasStep4) setStep(4);
    else if (hasStep3) setStep(3);
    else if (hasStep2) setStep(2);
    else if (hasStep1) setStep(1);
  }, [appliedSuggestions]);

  const toSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "businessName") {
      setBusinessName(value);
      // Auto-suggest slug if user hasn't manually edited it
      if (!slug || slug === toSlug(businessName)) {
        setSlug(toSlug(value));
      }
    }
    if (name === "slug") setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    if (name === "description") setDescription(value);
    if (name === "businessType") setBusinessType(value);
    if (name === "country") {
      setCountry(value);
      setCurrency(COUNTRY_DEFAULT_CURRENCY[value] ?? "XOF");
    }
    if (name === "taxRegime") setTaxRegime(value);
    if (name === "taxId") setTaxId(value.replace(/\s/g, ""));
    if (name === "legalStatus") setLegalStatus(value);
    if (name === "rccm") setRccm(value);
    if (name === "businessAddress") setBusinessAddress(value);
    if (name === "businessPhone") setBusinessPhone(value);
    if (name === "fiscalYearStart") setFiscalYearStart(value);
  };

  const saveAndNext = async () => {
    setError(null);
    try {
      if (step === 1) {
        await update({ businessName, businessType, slug: slug || undefined, description: description || undefined });
        setStep(2);
      } else if (step === 2) {
        // Currency is always derived from country; never allow divergence
        const currencyToSave = country ? (COUNTRY_DEFAULT_CURRENCY[country] ?? "XOF") : currency;
        await update({ country, currency: currencyToSave });
        setStep(3);
      } else if (step === 3) {
        await update({
          taxRegime: taxRegime || undefined,
          taxId: taxId || undefined,
          legalStatus: legalStatus || undefined,
          rccm: rccm || undefined,
        });
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
        await update({
          taxRegime: taxRegime || undefined,
          taxId: taxId || undefined,
          legalStatus: legalStatus || undefined,
          rccm: rccm || undefined,
          onboardingComplete: true,
        });
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
        ? country
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
        {step === 3 && "Structure légale & fiscal (optional)"}
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
          <div>
            <label htmlFor="slug" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              Store URL{" "}
              <span className="font-normal text-dark-4">(optional)</span>
            </label>
            <div className="flex items-center rounded-lg border border-stroke transition focus-within:border-primary dark:border-dark-3 dark:bg-dark-2 dark:focus-within:border-primary">
              <span className="whitespace-nowrap pl-4 text-sm text-dark-4 dark:text-dark-6">
                kabasika.com/store/
              </span>
              <input
                id="slug"
                type="text"
                name="slug"
                value={slug}
                onChange={handleChange}
                placeholder="my-shop"
                className="w-full bg-transparent py-3 pr-4 text-dark outline-none dark:text-white"
                aria-label="Store URL slug"
              />
            </div>
            {slug && (
              <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">
                Your store: kabasika.com/store/{slug}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="description" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              Description{" "}
              <span className="font-normal text-dark-4">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={description}
              onChange={handleChange}
              placeholder="A short description of your business"
              rows={3}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
              aria-label="Business description (optional)"
            />
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
            <span className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              Currency
            </span>
            <div
              className="flex items-center rounded-lg border border-stroke bg-gray-1 px-5.5 py-3 text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6"
              aria-live="polite"
            >
              {country ? (
                (() => {
                  const derived = COUNTRY_DEFAULT_CURRENCY[country] ?? "XOF";
                  const label = CURRENCIES.find((c) => c.value === derived)?.label ?? derived;
                  const countryLabel = COUNTRIES.find((c) => c.value === country)?.label ?? country;
                  return (
                    <>
                      <span className="font-medium text-dark dark:text-white">{label}</span>
                      <span className="ml-2 text-dark-4 dark:text-dark-6">(from {countryLabel})</span>
                    </>
                  );
                })()
              ) : (
                <span className="text-dark-4 dark:text-dark-6">Select a country to set your currency</span>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5" aria-labelledby="onboarding-step-title">
          {/* Legal status */}
          <div>
            <label htmlFor="legalStatus" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              Legal structure <span className="font-normal text-dark-4">(optional)</span>
            </label>
            <select
              id="legalStatus"
              name="legalStatus"
              value={legalStatus}
              onChange={handleChange}
              ref={firstInputRef as React.RefObject<HTMLSelectElement>}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
              aria-label="Legal structure"
            >
              <option value="">Select (optional)</option>
              <option value="auto_entrepreneur">Auto-entrepreneur / Micro-entreprise</option>
              <option value="sarl">SARL — Société à Responsabilité Limitée</option>
              <option value="sa">SA — Société Anonyme</option>
              <option value="snc">SNC — Société en Nom Collectif</option>
              <option value="association">Association / ONG</option>
              <option value="other">Autre</option>
            </select>
            {legalStatus === "auto_entrepreneur" && country === "BJ" && (
              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                💡 En tant qu'auto-entrepreneur au Bénin, l'IFU reste obligatoire pour vendre légalement. Il est gratuit et s'obtient en 24–48h sur impots.bj.
              </p>
            )}
            {(legalStatus === "sarl" || legalStatus === "sa") && (
              <p className="mt-1.5 text-xs text-dark-4 dark:text-dark-6">
                Les SARL et SA doivent être enregistrées au RCCM et disposer d'un IFU actif pour émettre des factures certifiées.
              </p>
            )}
          </div>

          {/* RCCM — shown for formal entities */}
          {(legalStatus === "sarl" || legalStatus === "sa" || legalStatus === "snc") && (
            <div>
              <label htmlFor="rccm" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
                RCCM <span className="font-normal text-dark-4">(Registre du Commerce)</span>
              </label>
              <input
                id="rccm"
                type="text"
                name="rccm"
                value={rccm}
                onChange={handleChange}
                placeholder={country === "BJ" ? "e.g. RB/COT/25 A 12345" : "Numéro RCCM"}
                className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                aria-label="RCCM registration number"
                autoComplete="off"
              />
              <p className="mt-1.5 text-xs text-dark-4 dark:text-dark-6">
                Numéro d'immatriculation au Registre du Commerce. Figurant sur vos statuts ou votre extrait RCCM.
              </p>
            </div>
          )}

          {/* Tax regime */}
          <div>
            <label htmlFor="taxRegime" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              Régime fiscal <span className="font-normal text-dark-4">(optional)</span>
            </label>
            <select
              id="taxRegime"
              name="taxRegime"
              value={taxRegime}
              onChange={handleChange}
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
            {taxRegime === "vat" && (
              <p className="mt-1.5 text-xs text-dark-4 dark:text-dark-6">
                TVA à 18 % appliquée automatiquement sur vos factures certifiées.
              </p>
            )}
          </div>

          {/* IFU / NCC — shown for supported countries */}
          {FISCAL_ID_COUNTRIES[country] && (
            <div>
              <label htmlFor="taxId" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
                {FISCAL_ID_COUNTRIES[country].label}
              </label>
              <input
                id="taxId"
                type="text"
                name="taxId"
                value={taxId}
                onChange={handleChange}
                placeholder={FISCAL_ID_COUNTRIES[country].placeholder}
                className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                aria-label={FISCAL_ID_COUNTRIES[country].label}
                autoComplete="off"
                inputMode="numeric"
              />
              <p className="mt-1.5 text-xs text-dark-4 dark:text-dark-6">
                {FISCAL_ID_COUNTRIES[country].hint}
              </p>
              {taxId && (
                <div className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800 dark:bg-green-900/20 dark:text-green-300">
                  ✓ Un QR code fiscal apparaîtra sur toutes vos factures.
                </div>
              )}
            </div>
          )}

          {/* Info banner for countries without e-invoicing yet */}
          {!FISCAL_ID_COUNTRIES[country] && country && (
            <div className="rounded-lg border border-stroke bg-gray-1 p-4 text-xs text-dark-4 dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6">
              La certification électronique des factures n'est pas encore disponible pour votre pays. Vous pourrez mettre à jour votre profil fiscal plus tard dans <strong>Paramètres → Profil entreprise</strong>.
            </div>
          )}
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

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as WizardStep)}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg border border-stroke px-6 py-3 font-medium text-dark transition hover:bg-gray-2 disabled:opacity-70 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-dark-2"
            aria-label="Go back to previous step"
          >
            ← Back
          </button>
        )}
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
