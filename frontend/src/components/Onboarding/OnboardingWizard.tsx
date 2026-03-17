"use client";

import { useOnboarding } from "@/hooks/use-onboarding";
import InputGroup from "@/components/FormElements/InputGroup";
import { useLocale } from "@/contexts/locale-context";
import { cn } from "@/lib/utils";
import React, { useState, useRef, useEffect } from "react";

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

const MONTH_KEYS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

type WizardStep = 1 | 2 | 3 | 4;

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
  const { t } = useLocale();
  const { data, update, loading } = useOnboarding(businessId);
  const [step, setStep] = useState<WizardStep>(1);

  const BUSINESS_TYPES = [
    { value: "retail", label: t("onboarding.businessTypes.retail") },
    { value: "restaurant", label: t("onboarding.businessTypes.restaurant") },
    { value: "services", label: t("onboarding.businessTypes.services") },
    { value: "manufacturing", label: t("onboarding.businessTypes.manufacturing") },
    { value: "agriculture", label: t("onboarding.businessTypes.agriculture") },
    { value: "other", label: t("onboarding.businessTypes.other") },
  ];

  const COUNTRIES = [
    { value: "NG", label: t("onboarding.countries.NG") },
    { value: "GH", label: t("onboarding.countries.GH") },
    { value: "BJ", label: t("onboarding.countries.BJ") },
    { value: "SN", label: t("onboarding.countries.SN") },
    { value: "CI", label: t("onboarding.countries.CI") },
    { value: "TG", label: t("onboarding.countries.TG") },
    { value: "CM", label: t("onboarding.countries.CM") },
    { value: "ML", label: t("onboarding.countries.ML") },
    { value: "NE", label: t("onboarding.countries.NE") },
    { value: "BF", label: t("onboarding.countries.BF") },
  ];

  const CURRENCIES = [
    { value: "NGN", label: t("onboarding.currencies.NGN") },
    { value: "GHS", label: t("onboarding.currencies.GHS") },
    { value: "XOF", label: t("onboarding.currencies.XOF") },
    { value: "XAF", label: t("onboarding.currencies.XAF") },
  ];

  const TAX_REGIMES = [
    { value: "vat", label: t("onboarding.taxRegime.vatRegistered") },
    { value: "simplified", label: t("onboarding.taxRegime.simplifiedTax") },
    { value: "none", label: t("onboarding.taxRegime.notRegistered") },
  ];

  const STEPS = [
    { id: 1, key: "business", title: t("onboarding.steps.business") },
    { id: 2, key: "location", title: t("onboarding.steps.location") },
    { id: 3, key: "tax", title: t("onboarding.steps.tax") },
    { id: 4, key: "details", title: t("onboarding.steps.details") },
  ];

  const FISCAL_YEAR_MONTHS = MONTH_KEYS.map((key, i) => ({
    value: i + 1,
    label: t(`onboarding.months.${key}`),
  }));
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
      label: t("onboarding.fiscalId.BJ.label"),
      placeholder: t("onboarding.fiscalId.BJ.placeholder"),
      hint: t("onboarding.fiscalId.BJ.hint"),
    },
    CI: {
      label: t("onboarding.fiscalId.CI.label"),
      placeholder: t("onboarding.fiscalId.CI.placeholder"),
      hint: t("onboarding.fiscalId.CI.hint"),
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
      setError(e instanceof Error ? e.message : t("onboarding.error"));
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
      setError(e instanceof Error ? e.message : t("onboarding.error"));
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
        <div className="space-y-4" aria-labelledby="onboarding-step-title">
          <InputGroup
            type="text"
            label={t("onboarding.form.businessName")}
            name="businessName"
            placeholder={t("onboarding.form.businessNamePlaceholder")}
            value={businessName}
            handleChange={handleChange}
            className="[&_input]:py-[15px]"
            error={error ?? undefined}
            inputRef={firstInputRef as React.RefObject<HTMLInputElement | null>}
          />
          <div>
            <label htmlFor="businessType" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              {t("onboarding.form.businessType")}
            </label>
            <select
              id="businessType"
              name="businessType"
              value={businessType}
              onChange={handleChange}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
              aria-label={t("onboarding.aria.businessType")}
            >
              <option value="">{t("onboarding.form.businessTypePlaceholder")}</option>
              {BUSINESS_TYPES.map((bt) => (
                <option key={bt.value} value={bt.value}>
                  {bt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="slug" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              {t("onboarding.form.storeUrl")}{" "}
              <span className="font-normal text-dark-4">{t("onboarding.form.optional")}</span>
            </label>
            <div className="flex items-center rounded-lg border border-stroke transition focus-within:border-primary dark:border-dark-3 dark:bg-dark-2 dark:focus-within:border-primary">
              <span className="whitespace-nowrap pl-4 text-sm text-dark-4 dark:text-dark-6">
                {t("onboarding.storeUrlPrefix")}
              </span>
              <input
                id="slug"
                type="text"
                name="slug"
                value={slug}
                onChange={handleChange}
                placeholder={t("onboarding.form.storeUrlPlaceholder")}
                className="w-full bg-transparent py-3 pr-4 text-dark outline-none dark:text-white"
                aria-label={t("onboarding.aria.storeUrl")}
              />
            </div>
            {slug && (
              <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">
                {t("onboarding.storeUrlSuffix", { slug })}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="description" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              {t("onboarding.form.description")}{" "}
              <span className="font-normal text-dark-4">{t("onboarding.form.optional")}</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={description}
              onChange={handleChange}
              placeholder={t("onboarding.form.descriptionPlaceholder")}
              rows={3}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
              aria-label={t("onboarding.aria.description")}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4" aria-labelledby="onboarding-step-title">
          <div>
            <label htmlFor="country" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              {t("onboarding.form.country")}
            </label>
            <select
              id="country"
              name="country"
              value={country}
              onChange={handleChange}
              ref={firstInputRef as React.RefObject<HTMLSelectElement>}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
              aria-label={t("onboarding.aria.country")}
            >
              <option value="">{t("onboarding.form.countryPlaceholder")}</option>
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              {t("onboarding.form.currency")}
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
                      <span className="ml-2 text-dark-4 dark:text-dark-6">({t("common.from")} {countryLabel})</span>
                    </>
                  );
                })()
              ) : (
                <span className="text-dark-4 dark:text-dark-6">{t("onboarding.form.currencyFromCountry")}</span>
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
              {t("onboarding.form.legalStructure")} <span className="font-normal text-dark-4">{t("onboarding.form.optional")}</span>
            </label>
            <select
              id="legalStatus"
              name="legalStatus"
              value={legalStatus}
              onChange={handleChange}
              ref={firstInputRef as React.RefObject<HTMLSelectElement>}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
              aria-label={t("onboarding.aria.legalStructure")}
            >
              <option value="">{t("onboarding.form.selectOptional")}</option>
              <option value="auto_entrepreneur">{t("onboarding.legalStatus.auto_entrepreneur")}</option>
              <option value="sarl">{t("onboarding.legalStatus.sarl")}</option>
              <option value="sa">{t("onboarding.legalStatus.sa")}</option>
              <option value="snc">{t("onboarding.legalStatus.snc")}</option>
              <option value="association">{t("onboarding.legalStatus.association")}</option>
              <option value="other">{t("onboarding.legalStatus.other")}</option>
            </select>
            {legalStatus === "auto_entrepreneur" && country === "BJ" && (
              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                {t("onboarding.autoEntrepreneurHint")}
              </p>
            )}
            {(legalStatus === "sarl" || legalStatus === "sa") && (
              <p className="mt-1.5 text-xs text-dark-4 dark:text-dark-6">
                {t("onboarding.sarlSaHint")}
              </p>
            )}
          </div>

          {/* RCCM — shown for formal entities */}
          {(legalStatus === "sarl" || legalStatus === "sa" || legalStatus === "snc") && (
            <div>
              <label htmlFor="rccm" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
                {t("onboarding.form.rccm")} <span className="font-normal text-dark-4">({t("onboarding.form.rccmRegistre")})</span>
              </label>
              <input
                id="rccm"
                type="text"
                name="rccm"
                value={rccm}
                onChange={handleChange}
                placeholder={country === "BJ" ? t("onboarding.form.rccmPlaceholderBJ") : t("onboarding.form.rccmPlaceholder")}
                className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                aria-label={t("onboarding.aria.rccm")}
                autoComplete="off"
              />
              <p className="mt-1.5 text-xs text-dark-4 dark:text-dark-6">
                {t("onboarding.form.rccmHint")}
              </p>
            </div>
          )}

          {/* Tax regime */}
          <div>
            <label htmlFor="taxRegime" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              {t("onboarding.form.taxRegime")} <span className="font-normal text-dark-4">{t("onboarding.form.optional")}</span>
            </label>
            <select
              id="taxRegime"
              name="taxRegime"
              value={taxRegime}
              onChange={handleChange}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
              aria-label={t("onboarding.aria.taxRegime")}
            >
              <option value="">{t("onboarding.form.selectOptional")}</option>
              {TAX_REGIMES.map((tr) => (
                <option key={tr.value} value={tr.value}>
                  {tr.label}
                </option>
              ))}
            </select>
            {taxRegime === "vat" && (
              <p className="mt-1.5 text-xs text-dark-4 dark:text-dark-6">
                {t("onboarding.vatHint")}
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
                  {t("onboarding.fiscalQrSuccess")}
                </div>
              )}
            </div>
          )}

          {/* Info banner for countries without e-invoicing yet */}
          {!FISCAL_ID_COUNTRIES[country] && country && (
            <div className="rounded-lg border border-stroke bg-gray-1 p-4 text-xs text-dark-4 dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6">
              {t("onboarding.noEinvCountryHint")}
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4" aria-labelledby="onboarding-step-title">
          <InputGroup
            type="text"
            label={t("onboarding.form.businessAddress")}
            name="businessAddress"
            placeholder={t("onboarding.form.businessAddressPlaceholder")}
            value={businessAddress}
            handleChange={handleChange}
            className="[&_input]:py-[15px]"
            inputRef={firstInputRef as React.RefObject<HTMLInputElement | null>}
          />
          <InputGroup
            type="text"
            label={t("onboarding.form.businessPhone")}
            name="businessPhone"
            placeholder={t("onboarding.form.businessPhonePlaceholder")}
            value={businessPhone}
            handleChange={handleChange}
            className="[&_input]:py-[15px]"
          />
          <div>
            <label htmlFor="fiscalYearStart" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
              {t("onboarding.form.fiscalYearStart")}
            </label>
            <select
              id="fiscalYearStart"
              name="fiscalYearStart"
              value={fiscalYearStart}
              onChange={handleChange}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
              aria-label={t("onboarding.aria.fiscalYearStart")}
            >
              <option value="">{t("onboarding.form.fiscalYearStartPlaceholder")}</option>
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
            aria-label={t("onboarding.aria.back")}
          >
            {t("onboarding.back")}
          </button>
        )}
        <button
          type="button"
          onClick={saveAndNext}
          disabled={loading || (step < 4 && !canProceed)}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-dark-2"
          aria-busy={loading}
        >
          {step < 4 ? t("onboarding.next") : t("onboarding.complete")}
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
            {t("onboarding.skip")}
          </button>
        )}
      </div>
    </div>
  );
}
