"use client";

import InputGroup from "@/components/FormElements/InputGroup";
import { useLocale } from "@/contexts/locale-context";

interface BusinessInfoStepProps {
  businessName: string;
  businessType: string;
  slug: string;
  description: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  error?: string | null;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function BusinessInfoStep({
  businessName,
  businessType,
  slug,
  description,
  handleChange,
  error,
  inputRef,
}: BusinessInfoStepProps) {
  const { t } = useLocale();

  const BUSINESS_TYPES = [
    { value: "retail", label: t("onboarding.businessTypes.retail") },
    { value: "restaurant", label: t("onboarding.businessTypes.restaurant") },
    { value: "services", label: t("onboarding.businessTypes.services") },
    { value: "manufacturing", label: t("onboarding.businessTypes.manufacturing") },
    { value: "agriculture", label: t("onboarding.businessTypes.agriculture") },
    { value: "other", label: t("onboarding.businessTypes.other") },
  ];

  return (
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
        inputRef={inputRef}
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
  );
}
