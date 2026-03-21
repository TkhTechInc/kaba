"use client";

import InputGroup from "@/components/FormElements/InputGroup";
import { useLocale } from "@/contexts/locale-context";

const MONTH_KEYS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

interface AdditionalDetailsStepProps {
  businessAddress: string;
  businessPhone: string;
  fiscalYearStart: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function AdditionalDetailsStep({
  businessAddress,
  businessPhone,
  fiscalYearStart,
  handleChange,
  inputRef,
}: AdditionalDetailsStepProps) {
  const { t } = useLocale();

  const FISCAL_YEAR_MONTHS = MONTH_KEYS.map((key, i) => ({
    value: i + 1,
    label: t(`onboarding.months.${key}`),
  }));

  return (
    <div className="space-y-4" aria-labelledby="onboarding-step-title">
      <InputGroup
        type="text"
        label={t("onboarding.form.businessAddress")}
        name="businessAddress"
        placeholder={t("onboarding.form.businessAddressPlaceholder")}
        value={businessAddress}
        handleChange={handleChange}
        className="[&_input]:py-[15px]"
        inputRef={inputRef}
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
  );
}
