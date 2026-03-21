"use client";

import { useLocale } from "@/contexts/locale-context";

interface LocationStepProps {
  country: string;
  handleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  inputRef?: React.RefObject<HTMLSelectElement>;
}

export function LocationStep({ country, handleChange, inputRef }: LocationStepProps) {
  const { t } = useLocale();

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

  return (
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
          ref={inputRef}
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
      <div className="rounded-lg bg-primary/10 p-4 text-sm text-dark dark:text-white">
        <p className="font-medium">{t("onboarding.currencyInfo.title")}</p>
        <p className="mt-1 text-dark-4 dark:text-dark-6">
          {t("onboarding.currencyInfo.description")}
        </p>
      </div>
    </div>
  );
}
