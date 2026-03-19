"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import InputGroup from "@/components/FormElements/InputGroup";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { useLocale } from "@/contexts/locale-context";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { getPhonePlaceholder } from "@/lib/country-dial-codes";
import { createInvoicesApi } from "@/services/invoices.service";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddCustomerPage() {
  const router = useRouter();
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const { t } = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const api = createInvoicesApi(token);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !form.name.trim()) return;
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("customerNew.emailError"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createCustomer({
        businessId,
        name: form.name.trim(),
        ...(email && { email }),
        ...(form.phone.trim() && { phone: form.phone.trim() }),
      });
      router.push(`/customers?search=${encodeURIComponent(form.name.trim())}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("customerNew.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName={t("customerNew.pageName")} />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("customerNew.noBusinessSelected")}</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName={t("customerNew.pageName")} />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("invoicing")) {
    return (
      <>
        <Breadcrumb pageName={t("customerNew.pageName")} />
        <UpgradePrompt feature="Invoicing" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName={t("customerNew.pageName")} />

      <div className="mx-auto max-w-xl rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">
          {t("customerNew.title")}
        </h2>
        <p className="mb-6 text-sm text-dark-6">
          {t("customerNew.subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded bg-red/10 p-3 text-sm text-red">{error}</div>
          )}
          <InputGroup
            label={t("customerNew.nameLabel")}
            type="text"
            placeholder={t("customerNew.namePlaceholder")}
            required
            value={form.name}
            handleChange={(e) =>
              setForm((f) => ({ ...f, name: e.target.value }))
            }
          />
          <InputGroup
            label={t("customerNew.emailLabel")}
            type="text"
            placeholder={t("customerNew.emailPlaceholder")}
            value={form.email}
            handleChange={(e) =>
              setForm((f) => ({ ...f, email: e.target.value }))
            }
          />
          <InputGroup
            label={t("customerNew.phoneLabel")}
            type="tel"
            placeholder={getPhonePlaceholder(features.countryCode)}
            value={form.phone}
            handleChange={(e) =>
              setForm((f) => ({ ...f, phone: e.target.value }))
            }
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? t("customerNew.submitting") : t("customerNew.submit")}
            </button>
            <Link
              href="/customers"
              className="rounded-lg border border-stroke px-4 py-2 font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              {t("customerNew.cancel")}
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
