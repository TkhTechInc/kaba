"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Price } from "@/components/ui/Price";
import { getPhonePlaceholder } from "@/lib/country-dial-codes";
import { createReceiptsApi } from "@/services/receipts.service";
import { createLedgerApi } from "@/services/ledger.service";
import type { ProcessReceiptResult } from "@/services/receipts.service";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";

export default function ReceiptsPage() {
  const { token, businessId } = useAuth();
  const features = useFeatures(businessId);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessReceiptResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useS3, setUseS3] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sendPhone, setSendPhone] = useState("");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const api = useMemo(() => createReceiptsApi(token), [token]);
  const ledgerApi = useMemo(() => createLedgerApi(token), [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setSaveStatus("idle");
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleProcessAnother = () => {
    setFile(null);
    setResult(null);
    setPreview(null);
    setSaveStatus("idle");
    setSaveError(null);
    setSendStatus("idle");
    setSendError(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleSaveAsExpense = async () => {
    if (!result || !businessId) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await ledgerApi.createEntry({
        businessId,
        type: "expense",
        amount: result.extracted.total ?? 0,
        currency: result.extracted.currency ?? "NGN",
        date: result.extracted.date ?? new Date().toISOString().slice(0, 10),
        description: result.extracted.vendor ?? "Receipt expense",
        category: result.suggestedCategory,
      });
      setSaveStatus("saved");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
      setSaveStatus("error");
    }
  };

  const handleSendReceipt = async () => {
    if (!result || !businessId || !sendPhone.trim()) return;
    setSendStatus("sending");
    setSendError(null);
    try {
      const res = await api.sendPdf(businessId, sendPhone.trim(), {
        vendor: result.extracted.vendor,
        date: result.extracted.date,
        total: result.extracted.total ?? 0,
        currency: result.extracted.currency,
        items:
          result.extracted.lineItems.length > 0
            ? result.extracted.lineItems.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
              }))
            : undefined,
      });
      if (res.success) {
        setSendStatus("sent");
      } else {
        setSendError("Failed to send");
        setSendStatus("error");
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Failed to send");
      setSendStatus("error");
    }
  };

  const processWithBase64 = useCallback(async () => {
    if (!businessId || !file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string)?.split(",")[1];
      if (!base64) {
        setError("Failed to read file");
        setLoading(false);
        return;
      }
      try {
        const res = await api.process(businessId, { imageBase64: base64 });
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Processing failed");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }, [businessId, file, api]);

  const processWithS3 = useCallback(async () => {
    if (!businessId || !file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const contentType = file.type || "image/jpeg";
      const { data } = await api.getUploadUrl(businessId, contentType);
      const uploadRes = await fetch(data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });
      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }
      const res = await api.process(businessId, { s3Key: data.key });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed");
    } finally {
      setLoading(false);
    }
  }, [businessId, file, api]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !file) return;
    if (useS3) {
      processWithS3();
    } else {
      processWithBase64();
    }
  };

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="Receipts" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to process receipts.</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName="Receipts" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("receipts")) {
    return (
      <>
        <Breadcrumb pageName="Receipts" />
        <UpgradePrompt feature="Receipts" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Receipts" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">
            Upload Receipt
          </h3>
          <p className="mb-4 text-sm text-dark-6">
            Take a photo of your receipt or choose an image from your device. We&apos;ll read the details for you.
          </p>
          {error && (
            <div className="mb-4 rounded bg-red/10 p-3 text-sm text-red">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
                Photo or image of your receipt
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="w-full rounded-lg border border-stroke px-4 py-3 file:mr-4 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:text-white dark:border-dark-3 dark:bg-dark-2"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !file}
              className="w-full rounded-lg bg-primary py-3 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Reading receipt…" : "Read receipt"}
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">
            Receipt details
          </h3>
          {!result ? (
            <div className="space-y-4">
              {preview && (
                <div className="overflow-hidden rounded-lg border border-stroke dark:border-dark-3">
                  <img src={preview} alt="Receipt preview" className="max-h-48 w-full object-contain" />
                </div>
              )}
              <p className="text-dark-6">
                Your receipt details will appear here after you upload.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {(() => {
                const hasVendor = !!result.extracted.vendor;
                const hasDate = !!result.extracted.date;
                const hasTotal = result.extracted.total != null;
                const confidence = hasVendor && hasDate && hasTotal ? "high" : hasTotal ? "medium" : "low";
                return (
                  <div
                    role="status"
                    className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      confidence === "high"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : confidence === "medium"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    <span aria-hidden="true">
                      {confidence === "high" ? "✓" : confidence === "medium" ? "⚠" : "!"}
                    </span>
                    <span>
                      {confidence === "high"
                        ? "Looks good"
                        : confidence === "medium"
                        ? "Please check the details — some may need editing"
                        : "Please double-check all fields"}
                    </span>
                  </div>
                );
              })()}
              <div className="rounded-lg bg-gray-2 p-4 dark:bg-dark-2">
                <h4 className="mb-2 text-sm font-medium text-dark dark:text-white">
                  Summary
                </h4>
                <dl className="space-y-1 text-sm">
                  {result.extracted.vendor && (
                    <div>
                      <dt className="inline font-medium text-dark-6">Shop: </dt>
                      <dd className="inline">{result.extracted.vendor}</dd>
                    </div>
                  )}
                  {result.extracted.date && (
                    <div>
                      <dt className="inline font-medium text-dark-6">Date: </dt>
                      <dd className="inline">{result.extracted.date}</dd>
                    </div>
                  )}
                  {result.extracted.total != null && (
                    <div>
                      <dt className="inline font-medium text-dark-6">Total: </dt>
                      <dd className="inline">
                        <Price amount={result.extracted.total} currency={result.extracted.currency ?? "NGN"} />
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline font-medium text-dark-6">
                      Category:{" "}
                    </dt>
                    <dd className="inline font-medium">
                      {result.suggestedCategory}
                    </dd>
                  </div>
                </dl>
              </div>
              {features.isEnabled("ledger") && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSaveAsExpense}
                    disabled={saveStatus === "saving" || (result.extracted.total ?? 0) <= 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    {saveStatus === "saving" && (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    {saveStatus === "saved" ? "✓ Saved to Ledger" : saveStatus === "saving" ? "Saving…" : "Save as expense"}
                  </button>
                  {saveStatus === "error" && saveError && (
                    <span className="text-sm text-red">{saveError}</span>
                  )}
                  {saveStatus === "saved" && (
                    <a
                      href="/ledger"
                      className="text-sm font-medium text-primary underline hover:no-underline"
                    >
                      View in Ledger →
                    </a>
                  )}
                </div>
              )}
              {features.isEnabled("receipt_pdf_whatsapp") && (
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-body-sm font-medium text-dark dark:text-white">
                      Customer phone
                    </label>
                    <input
                      type="tel"
                      value={sendPhone}
                      onChange={(e) => setSendPhone(e.target.value)}
                      placeholder={getPhonePlaceholder(features.countryCode)}
                      className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendReceipt}
                    disabled={
                      sendStatus === "sending" ||
                      (result.extracted.total ?? 0) <= 0 ||
                      !sendPhone.trim()
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    {sendStatus === "sending" && (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    )}
                    {sendStatus === "sent"
                      ? "✓ Sent"
                      : sendStatus === "sending"
                        ? "Sending…"
                        : "Send receipt"}
                  </button>
                  {sendStatus === "error" && sendError && (
                    <span className="text-sm text-red">{sendError}</span>
                  )}
                </div>
              )}
              {result.extracted.lineItems.length > 0 && (
                <ResponsiveDataList<{ description: string; quantity: number; unitPrice: number; total: number }>
                  items={result.extracted.lineItems}
                  keyExtractor={(item) => `${item.description}-${item.quantity}-${item.total}`}
                  emptyMessage="No line items"
                  columns={[
                    { key: "description", label: "Description", render: (item) => item.description, prominent: true },
                    { key: "qty", label: "Qty", render: (item) => String(item.quantity), align: "right" },
                    { key: "unitPrice", label: "Unit Price", render: (item) => <Price amount={item.unitPrice} currency={result.extracted.currency ?? "NGN"} />, align: "right" },
                    { key: "total", label: "Total", render: (item) => <Price amount={item.total} currency={result.extracted.currency ?? "NGN"} />, align: "right" },
                  ]}
                />
              )}
              {result.extracted.rawText && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-dark-6">
                    View full text
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-2 p-3 text-dark-6 dark:bg-dark-2">
                    {result.extracted.rawText}
                  </pre>
                </details>
              )}
              <button
                type="button"
                onClick={handleProcessAnother}
                className="mt-4 rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
              >
                Add another receipt
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
