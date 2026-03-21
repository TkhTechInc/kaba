"use client";

import { useLocale } from "@/contexts/locale-context";

interface TaxLegalStepProps {
  country: string;
  legalStatus: string;
  rccm: string;
  taxRegime: string;
  taxId: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  inputRef?: React.RefObject<HTMLSelectElement>;
}

export function TaxLegalStep({
  country,
  legalStatus,
  rccm,
  taxRegime,
  taxId,
  handleChange,
  inputRef,
}: TaxLegalStepProps) {
  const { t } = useLocale();

  const TAX_REGIMES = [
    { value: "vat", label: t("onboarding.taxRegime.vatRegistered") },
    { value: "simplified", label: t("onboarding.taxRegime.simplifiedTax") },
    { value: "none", label: t("onboarding.taxRegime.notRegistered") },
  ];

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

  return (
    <div className="space-y-5" aria-labelledby="onboarding-step-title">
      <div>
        <label htmlFor="legalStatus" className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
          {t("onboarding.form.legalStructure")} <span className="font-normal text-dark-4">{t("onboarding.form.optional")}</span>
        </label>
        <select
          id="legalStatus"
          name="legalStatus"
          value={legalStatus}
          onChange={handleChange}
          ref={inputRef}
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

      {!FISCAL_ID_COUNTRIES[country] && country && (
        <div className="rounded-lg border border-stroke bg-gray-1 p-4 text-xs text-dark-4 dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6">
          {t("onboarding.noEinvCountryHint")}
        </div>
      )}
    </div>
  );
}
