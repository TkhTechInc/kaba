"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import InputGroup from "@/components/FormElements/InputGroup";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { getCurrencyForCountry } from "@/lib/country-currency";
import { useLocale } from "@/contexts/locale-context";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { getPhonePlaceholder } from "@/lib/country-dial-codes";
import { createDebtsApi } from "@/services/debts.service";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Currency locked to business default - change in Settings > Business Profile

export default function AddDebtPage() {
  const router = useRouter();
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const { t } = useLocale();
  const defaultCurrency =
    features.currency ?? getCurrencyForCountry(features.countryCode ?? "");
  const phonePlaceholder = getPhonePlaceholder(features.countryCode);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    debtorName: "",
    amount: "",
    currency: defaultCurrency,
    dueDate: new Date().toISOString().slice(0, 10),
    phone: "",
    notes: "",
  });

  const api = createDebtsApi(token);

  useEffect(() => {
    setForm((f) =>
      !f.debtorName && !f.amount ? { ...f, currency: defaultCurrency } : f
    );
  }, [defaultCurrency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !form.debtorName.trim() || !form.amount || !form.dueDate) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.create({
        businessId,
        debtorName: form.debtorName.trim(),
        amount: Number(form.amount),
        currency: form.currency,
        dueDate: form.dueDate,
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      router.push(`/debts?search=${encodeURIComponent(form.debtorName.trim())}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("debts.new.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName={t("debts.new.pageName")} />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("debts.new.noBusinessSelected")}</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName={t("debts.new.pageName")} />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("debt_tracker")) {
    return (
      <>
        <Breadcrumb pageName={t("debts.new.pageName")} />
        <UpgradePrompt feature={t("debts.upgradeFeature")} />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName={t("debts.new.pageName")} />

      <div className="mx-auto max-w-xl rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="mb-2 text-lg font-semibold text-dark dark:text-white">
          {t("debts.new.title")}
        </h2>
        <p className="mb-6 text-sm text-dark-6">
          {t("debts.new.subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded bg-red/10 p-3 text-sm text-red">{error}</div>
          )}
          <InputGroup
            label={t("debts.new.name")}
            type="text"
            value={form.debtorName}
            handleChange={(e) => setForm((f) => ({ ...f, debtorName: e.target.value }))}
            placeholder={t("debts.new.namePlaceholder")}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <InputGroup
              label={t("debts.new.amount")}
              type="number"
              value={form.amount}
              handleChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0"
              required
            />
            <div>
              <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">{t("debts.new.currency")}</label>
              <div className="flex items-center justify-between rounded-lg border border-stroke bg-gray-2 px-4 py-3 dark:border-dark-3 dark:bg-dark-2">
                <span className="text-dark dark:text-white">{form.currency}</span>
                <Link
                  href="/settings/profile"
                  className="text-xs text-primary hover:underline"
                >
                  Settings
                </Link>
              </div>
            </div>
          </div>
          <InputGroup
            label={t("debts.new.dueDate")}
            type="date"
            value={form.dueDate}
            handleChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            placeholder=""
            required
          />
          <InputGroup
            label={t("debts.new.phone")}
            type="text"
            value={form.phone}
            handleChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder={phonePlaceholder}
          />
          <InputGroup
            label={t("debts.new.notes")}
            type="text"
            value={form.notes}
            handleChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder={t("debts.new.notesPh")}
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? t("debts.new.submitting") : t("debts.new.submit")}
            </button>
            <Link
              href="/debts"
              className="rounded-lg border border-stroke px-4 py-2 font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              {t("debts.new.cancel")}
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
