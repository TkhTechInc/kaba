"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { useFeatures } from "@/hooks/use-features";
import { getCurrencyForCountry } from "@/lib/country-currency";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { ApiError } from "@/lib/api-client";
import { createSuppliersApi, type Supplier, type CreateSupplierInput, type PaySupplierInput } from "@/services/suppliers.service";
import { useEffect, useState } from "react";
import { ListSearchInput } from "@/components/ui/list-search-input";

type ModalState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; supplier: Supplier }
  | { type: "pay"; supplier: Supplier };

const EMPTY_FORM_BASE: Omit<CreateSupplierInput, "currency"> = {
  name: "",
  countryCode: "NG",
  phone: "",
  momoPhone: "",
  bankAccount: "",
  notes: "",
};

export default function SuppliersPage() {
  const { token, businessId } = useAuth();
  const { t } = useLocale();
  const features = useFeatures(businessId);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [form, setForm] = useState<CreateSupplierInput>(() => ({
    ...EMPTY_FORM_BASE,
    currency:
      features.currency ?? getCurrencyForCountry(features.countryCode ?? ""),
  }));
  const [payForm, setPayForm] = useState<PaySupplierInput>({
    amount: 0,
    currency: features.currency ?? getCurrencyForCountry(features.countryCode ?? ""),
    description: "",
  });
  const [payAmountStr, setPayAmountStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const suppliersApi = createSuppliersApi(token);

  const load = () => {
    if (!businessId) return;
    setError(null);
    setLoading(true);
    suppliersApi
      .list(businessId)
      .then((r) => setSuppliers(r.data.items ?? []))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : t("suppliers.error.load"));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const openCreate = () => {
    setForm({
      ...EMPTY_FORM_BASE,
      currency:
        features.currency ?? getCurrencyForCountry(features.countryCode ?? ""),
    });
    setModalError(null);
    setModal({ type: "create" });
  };

  const openEdit = (supplier: Supplier) => {
    setForm({
      name: supplier.name,
      currency: supplier.currency,
      countryCode: supplier.countryCode,
      phone: supplier.phone ?? "",
      momoPhone: supplier.momoPhone ?? "",
      bankAccount: supplier.bankAccount ?? "",
      notes: supplier.notes ?? "",
    });
    setModalError(null);
    setModal({ type: "edit", supplier });
  };

  const openPay = (supplier: Supplier) => {
    setPayForm({ amount: 0, currency: supplier.currency, description: "" });
    setPayAmountStr("");
    setModal({ type: "pay", supplier });
  };

  const closeModal = () => { setModal({ type: "none" }); setModalError(null); };

  const handleSubmitCreate = () => {
    if (!businessId) return;
    setSubmitting(true);
    setModalError(null);
    suppliersApi
      .create(businessId, form)
      .then(() => { closeModal(); load(); })
      .catch((e: unknown) => {
        console.error("[suppliers] create failed:", e);
        setModalError(e instanceof Error ? e.message : t("suppliers.error.create"));
      })
      .finally(() => setSubmitting(false));
  };

  const handleSubmitEdit = () => {
    if (!businessId || modal.type !== "edit") return;
    setSubmitting(true);
    setModalError(null);
    suppliersApi
      .update(businessId, modal.supplier.id, form)
      .then(() => { closeModal(); load(); })
      .catch((e: unknown) => {
        console.error("[suppliers] update failed:", e);
        setModalError(e instanceof Error ? e.message : t("suppliers.error.update"));
      })
      .finally(() => setSubmitting(false));
  };

  const handleDelete = (id: string) => {
    if (!businessId || !confirm(t("suppliers.deleteConfirm"))) return;
    suppliersApi
      .deleteSupplier(businessId, id)
      .then(() => load())
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t("suppliers.error.delete")));
  };

  const handlePay = () => {
    if (!businessId || modal.type !== "pay") return;
    const amount = parseFloat(payAmountStr) || 0;
    if (amount <= 0) return;
    setSubmitting(true);
    suppliersApi
      .paySupplier(businessId, modal.supplier.id, { ...payForm, amount })
      .then(() => { closeModal(); setError(null); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t("suppliers.error.pay")))
      .finally(() => setSubmitting(false));
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName={t("suppliers.title")} />
        <div className="min-w-0 rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">{t("suppliers.noBusinessSelected")}</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName={t("suppliers.title")} />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  const canShowSuppliers =
    features.isEnabled("suppliers") ||
    features.isEnabled("ledger") ||
    features.isEnabled("invoicing");
  if (!canShowSuppliers) {
    return (
      <>
        <Breadcrumb pageName={t("suppliers.title")} />
        <UpgradePrompt feature={t("suppliers.title")} />
      </>
    );
  }

  if (forbidden) {
    return (
      <>
        <Breadcrumb pageName={t("suppliers.title")} />
        <div className="min-w-0 rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-red">{t("suppliers.forbidden")}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName={t("suppliers.title")} />

      <div className="rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stroke px-4 py-3 sm:px-6 sm:py-4 dark:border-dark-3">
          <h3 className="font-semibold text-dark dark:text-white">{t("suppliers.title")}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <ListSearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("suppliers.search")}
            />
            <button
            type="button"
            onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              + {t("suppliers.addSupplier")}
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-2 rounded bg-red/10 p-3 text-sm text-red">{error}</div>
        )}

        <div className="-mx-4 sm:mx-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            (() => {
              const q = search.trim().toLowerCase();
              const visibleSuppliers = q
                ? suppliers.filter(
                    (s) =>
                      (s.name ?? "").toLowerCase().includes(q) ||
                      (s.phone ?? "").toLowerCase().includes(q) ||
                      (s.momoPhone ?? "").toLowerCase().includes(q) ||
                      (s.currency ?? "").toLowerCase().includes(q) ||
                      (s.countryCode ?? "").toLowerCase().includes(q)
                  )
                : suppliers;
              return (
                <ResponsiveDataList<Supplier>
                  items={visibleSuppliers}
                  keyExtractor={(s) => s.id}
                  emptyMessage={
                    search.trim() ? (
                      t("suppliers.noResults")
                    ) : (
                      <>
                        {t("suppliers.noSuppliersYet")}{" "}
                        <button
                          type="button"
                          onClick={openCreate}
                          className="text-primary hover:underline"
                        >
                          {t("suppliers.addFirstSupplier")}
                        </button>
                      </>
                    )
                  }
                  columns={[
                    { key: "name", label: t("suppliers.column.name"), render: (s) => s.name, prominent: true },
                    {
                      key: "phoneMomo",
                      label: t("suppliers.column.phoneMomo"),
                      render: (s) =>
                        s.momoPhone ? (
                          <span title={t("suppliers.form.momoPhone")}>{s.momoPhone}</span>
                        ) : (
                          s.phone ?? <span className="italic text-dark-5">—</span>
                        ),
                    },
                    { key: "currency", label: t("suppliers.column.currency"), render: (s) => s.currency },
                    { key: "country", label: t("suppliers.column.country"), render: (s) => s.countryCode },
                  ]}
                  renderActions={(s) => (
                    <>
                      <button
                        type="button"
                        onClick={() => openPay(s)}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {t("suppliers.action.pay")}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="text-sm font-medium text-dark-6 hover:underline"
                      >
                        {t("suppliers.action.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        className="text-sm font-medium text-red hover:underline"
                      >
                        {t("suppliers.action.delete")}
                      </button>
                    </>
                  )}
                />
              );
            })()
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      {(modal.type === "create" || modal.type === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">
              {modal.type === "create" ? t("suppliers.addSupplier") : t("suppliers.editSupplier")}
            </h2>
            {modalError && (
              <div className="mb-3 rounded bg-red/10 p-3 text-sm text-red">{modalError}</div>
            )}
            <div className="space-y-3">
              {(["name", "phone", "momoPhone", "bankAccount", "currency", "countryCode", "notes"] as const).map((field) => (
                <div key={field}>
                  <label className="mb-1 block text-sm font-medium text-dark-5 dark:text-dark-6">
                    {field === "momoPhone"
                      ? t("suppliers.form.momoPhone")
                      : field === "bankAccount"
                        ? t("suppliers.form.bankAccount")
                        : field === "countryCode"
                          ? t("suppliers.form.countryCode")
                          : field === "name"
                            ? t("suppliers.form.name")
                            : field === "phone"
                              ? t("suppliers.form.phone")
                              : field === "currency"
                                ? t("suppliers.form.currency")
                                : field === "notes"
                                  ? t("suppliers.form.notes")
                                  : field}
                    {(field === "name" || field === "currency" || field === "countryCode") && (
                      <span className="text-red">{t("suppliers.form.required")}</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={form[field] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={modal.type === "create" ? handleSubmitCreate : handleSubmitEdit}
                disabled={submitting || !form.name || !form.currency || !form.countryCode}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? t("suppliers.form.saving") : modal.type === "create" ? t("suppliers.addSupplier") : t("suppliers.form.saveChanges")}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-lg border border-stroke px-4 py-2.5 text-sm font-medium text-dark-5 hover:bg-gray-2 dark:border-dark-3 dark:text-dark-6 dark:hover:bg-dark-2"
              >
                {t("suppliers.form.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay modal */}
      {modal.type === "pay" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark">
            <h2 className="mb-1 text-lg font-semibold text-dark dark:text-white">
              {t("suppliers.payModal.title", { name: modal.supplier.name })}
            </h2>
            <p className="mb-4 text-sm text-dark-6">{t("suppliers.payModal.subtitle")}</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-5 dark:text-dark-6">
                  {t("suppliers.payModal.amount")} <span className="text-red">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={payAmountStr}
                  onChange={(e) => setPayAmountStr(e.target.value)}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-5 dark:text-dark-6">{t("suppliers.payModal.currency")}</label>
                <input
                  type="text"
                  value={payForm.currency}
                  onChange={(e) => setPayForm((f) => ({ ...f, currency: e.target.value }))}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-5 dark:text-dark-6">{t("suppliers.payModal.description")}</label>
                <input
                  type="text"
                  value={payForm.description ?? ""}
                  placeholder={t("suppliers.payModal.placeholder", { name: modal.supplier.name })}
                  onChange={(e) => setPayForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handlePay}
                disabled={submitting || !payAmountStr || parseFloat(payAmountStr) <= 0}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? t("suppliers.payModal.processing") : t("suppliers.payModal.recordPayment")}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-lg border border-stroke px-4 py-2.5 text-sm font-medium text-dark-5 hover:bg-gray-2 dark:border-dark-3 dark:text-dark-6 dark:hover:bg-dark-2"
              >
                {t("suppliers.form.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
