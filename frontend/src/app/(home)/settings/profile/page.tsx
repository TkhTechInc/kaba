"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useLocale } from "@/contexts/locale-context";
import Link from "next/link";

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

const TAX_REGIMES = [
  { value: "vat", label: "VAT registered" },
  { value: "simplified", label: "Simplified tax" },
  { value: "none", label: "Not registered" },
];

const SETTINGS_NAV = [
  { label: "Plans", href: "/settings/plans" },
  { label: "Business Profile", href: "/settings/profile" },
  { label: "Team", href: "/settings/team" },
  { label: "Activity Log", href: "/settings/activity" },
  { label: "Preferences", href: "/settings/preferences" },
  { label: "API Keys", href: "/settings/api-keys" },
  { label: "Webhooks", href: "/settings/webhooks" },
  { label: "Compliance", href: "/settings/compliance" },
];

export default function BusinessProfilePage() {
  const { businessId } = useAuth();
  const { t } = useLocale();
  const { data, update, loading } = useOnboarding(businessId ?? null);

  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("");
  const [taxRegime, setTaxRegime] = useState("");
  const [taxId, setTaxId] = useState("");
  const [legalStatus, setLegalStatus] = useState("");
  const [rccm, setRccm] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.answers) {
      setBusinessName(data.answers.businessName ?? "");
      setCountry(data.answers.country ?? "");
      setCurrency(data.answers.currency ?? "");
      setTaxRegime(data.answers.taxRegime ?? "");
      setTaxId(data.answers.taxId ?? "");
      setLegalStatus(data.answers.legalStatus ?? "");
      setRccm(data.answers.rccm ?? "");
      setBusinessAddress(data.answers.businessAddress ?? "");
      setBusinessPhone(data.answers.businessPhone ?? "");
      setSlug(data.answers.slug ?? "");
      setDescription(data.answers.description ?? "");
    }
  }, [data?.answers]);

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    try {
      await update({
        businessName: businessName || undefined,
        country: country || undefined,
        currency: currency || undefined,
        taxRegime: taxRegime || undefined,
        taxId: taxId || undefined,
        legalStatus: legalStatus || undefined,
        rccm: rccm || undefined,
        businessAddress: businessAddress || undefined,
        businessPhone: businessPhone || undefined,
        slug: slug || undefined,
        description: description || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    }
  };

  const fiscalInfo = FISCAL_ID_COUNTRIES[country];

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Settings navigation">
        {SETTINGS_NAV.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:text-white dark:hover:border-primary dark:hover:text-primary"
          >
            {label}
          </Link>
        ))}
      </nav>

      <h1 className="mb-2 text-heading-4 font-bold text-dark dark:text-white">
        Business Profile
      </h1>
      <p className="mb-6 text-sm text-dark-4 dark:text-dark-6">
        Keep your business information up to date. Your IFU or fiscal ID unlocks QR code certification on all your invoices.
      </p>

      {loading && (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Identity */}
          <section className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
            <h2 className="mb-4 text-base font-semibold text-dark dark:text-white">Business Identity</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                  Business Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Mama's Shop"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                  Description <span className="font-normal text-dark-4">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A short description of your business"
                  rows={3}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                  Store URL <span className="font-normal text-dark-4">(optional)</span>
                </label>
                <div className="flex items-center rounded-lg border border-stroke transition focus-within:border-primary dark:border-dark-3 dark:bg-dark-2">
                  <span className="whitespace-nowrap pl-4 text-sm text-dark-4 dark:text-dark-6">
                    kabasika.com/store/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="my-shop"
                    className="w-full bg-transparent py-2.5 pr-4 text-dark outline-none dark:text-white"
                  />
                </div>
                {slug && (
                  <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">
                    Your store: kabasika.com/store/{slug}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Location & Currency */}
          <section className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
            <h2 className="mb-4 text-base font-semibold text-dark dark:text-white">Location & Currency</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">Country</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                >
                  <option value="">Select currency</option>
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
            <h2 className="mb-4 text-base font-semibold text-dark dark:text-white">Contact Details</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                  Business Address <span className="font-normal text-dark-4">(optional)</span>
                </label>
                <input
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="e.g. Rue du Commerce, Cotonou"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                  Business Phone <span className="font-normal text-dark-4">(optional)</span>
                </label>
                <input
                  type="text"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  placeholder="e.g. +229 96 00 00 00"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                />
              </div>
            </div>
          </section>

          {/* Tax / Fiscal */}
          <section className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
            <h2 className="mb-1 text-base font-semibold text-dark dark:text-white">Tax & Fiscal Information</h2>
            <p className="mb-4 text-sm text-dark-4 dark:text-dark-6">
              Providing your fiscal ID enables QR code certification on every invoice — even without a paid plan.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">Legal Structure</label>
                <select
                  value={legalStatus}
                  onChange={(e) => setLegalStatus(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                >
                  <option value="">Select (optional)</option>
                  <option value="auto_entrepreneur">Auto-entrepreneur / Micro-entreprise</option>
                  <option value="sarl">SARL — Société à Responsabilité Limitée</option>
                  <option value="sa">SA — Société Anonyme</option>
                  <option value="snc">SNC — Société en Nom Collectif</option>
                  <option value="association">Association / ONG</option>
                  <option value="other">Autre</option>
                </select>
              </div>

              {(legalStatus === "sarl" || legalStatus === "sa" || legalStatus === "snc") && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                    RCCM <span className="font-normal text-dark-4">(Registre du Commerce)</span>
                  </label>
                  <input
                    type="text"
                    value={rccm}
                    onChange={(e) => setRccm(e.target.value)}
                    placeholder={country === "BJ" ? "e.g. RB/COT/25 A 12345" : "Numéro RCCM"}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">
                    Numéro d'immatriculation au Registre du Commerce. Visible sur vos statuts ou votre extrait RCCM.
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">Tax Regime</label>
                <select
                  value={taxRegime}
                  onChange={(e) => setTaxRegime(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                >
                  <option value="">Select (optional)</option>
                  {TAX_REGIMES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {fiscalInfo ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                    {fiscalInfo.label}
                  </label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value.replace(/\s/g, ""))}
                    placeholder={fiscalInfo.placeholder}
                    inputMode="numeric"
                    autoComplete="off"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                  />
                  <p className="mt-1.5 text-xs text-dark-4 dark:text-dark-6">{fiscalInfo.hint}</p>
                  {taxId && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800 dark:bg-green-900/20 dark:text-green-300">
                      <span>✓</span>
                      <span>
                        QR code will appear on all invoices once saved.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                    Tax ID / Fiscal Number <span className="font-normal text-dark-4">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value.replace(/\s/g, ""))}
                    placeholder="Enter your tax ID"
                    autoComplete="off"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                  />
                  <p className="mt-1.5 text-xs text-dark-4 dark:text-dark-6">
                    Select your country above to see the specific fiscal ID format.
                  </p>
                </div>
              )}
            </div>
          </section>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {saved && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              ✓ Profile saved successfully.
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={loading}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
