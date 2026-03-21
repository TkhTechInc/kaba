import { useState, useEffect } from "react";

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

interface OnboardingFormData {
  businessName: string;
  businessType: string;
  slug: string;
  description: string;
  country: string;
  currency: string;
  taxRegime: string;
  taxId: string;
  legalStatus: string;
  rccm: string;
  businessAddress: string;
  businessPhone: string;
  fiscalYearStart: string;
}

interface UseOnboardingFormProps {
  initialData?: Partial<OnboardingFormData>;
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
}

export function useOnboardingForm({ initialData, appliedSuggestions }: UseOnboardingFormProps) {
  const [businessName, setBusinessName] = useState(initialData?.businessName ?? "");
  const [businessType, setBusinessType] = useState(initialData?.businessType ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [country, setCountry] = useState(initialData?.country ?? "");
  const [currency, setCurrency] = useState(initialData?.currency ?? "");
  const [taxRegime, setTaxRegime] = useState(initialData?.taxRegime ?? "");
  const [taxId, setTaxId] = useState(initialData?.taxId ?? "");
  const [legalStatus, setLegalStatus] = useState(initialData?.legalStatus ?? "");
  const [rccm, setRccm] = useState(initialData?.rccm ?? "");
  const [businessAddress, setBusinessAddress] = useState(initialData?.businessAddress ?? "");
  const [businessPhone, setBusinessPhone] = useState(initialData?.businessPhone ?? "");
  const [fiscalYearStart, setFiscalYearStart] = useState(
    initialData?.fiscalYearStart ?? ""
  );

  // Update from initial data
  useEffect(() => {
    if (initialData) {
      setBusinessName(initialData.businessName ?? "");
      setBusinessType(initialData.businessType ?? "");
      setSlug(initialData.slug ?? "");
      setDescription(initialData.description ?? "");
      setCountry(initialData.country ?? "");
      const derivedCurrency = initialData.country
        ? (COUNTRY_DEFAULT_CURRENCY[initialData.country] ?? "XOF")
        : (initialData.currency ?? "");
      setCurrency(derivedCurrency);
      setTaxRegime(initialData.taxRegime ?? "");
      setTaxId(initialData.taxId ?? "");
      setLegalStatus(initialData.legalStatus ?? "");
      setRccm(initialData.rccm ?? "");
      setBusinessAddress(initialData.businessAddress ?? "");
      setBusinessPhone(initialData.businessPhone ?? "");
      setFiscalYearStart(initialData.fiscalYearStart ?? "");
    }
  }, [initialData]);

  // Apply suggestions
  useEffect(() => {
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

  return {
    formData: {
      businessName,
      businessType,
      slug,
      description,
      country,
      currency,
      taxRegime,
      taxId,
      legalStatus,
      rccm,
      businessAddress,
      businessPhone,
      fiscalYearStart,
    },
    handlers: {
      handleChange,
      setBusinessName,
      setBusinessType,
      setSlug,
      setDescription,
      setCountry,
      setCurrency,
      setTaxRegime,
      setTaxId,
      setLegalStatus,
      setRccm,
      setBusinessAddress,
      setBusinessPhone,
      setFiscalYearStart,
    },
  };
}
