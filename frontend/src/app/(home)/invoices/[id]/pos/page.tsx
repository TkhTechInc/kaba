"use client";

import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { apiPost, apiGet } from "@/lib/api-client";
import { Price } from "@/components/ui/Price";
import { createInvoicesApi } from "@/services/invoices.service";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface InvoiceDetail {
  id: string;
  businessId: string;
  customerId: string;
  amount: number;
  currency: string;
  status: string;
  dueDate?: string;
}

interface ShareResponse {
  success: boolean;
  data: { token: string; payUrl: string };
}

interface PollResponse {
  success: boolean;
  data: { status: string; amount: number; currency: string };
}

type PageState = "loading" | "ready" | "paid" | "error" | "timeout";

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_TIMES   = 120;

export default function PosTerminalPage() {
  const params     = useParams();
  const invoiceId  = params?.id as string;
  const { token, businessId } = useAuth();
  const { t } = useLocale();

  const [pageState,    setPageState]    = useState<PageState>("loading");
  const [invoice,      setInvoice]      = useState<InvoiceDetail | null>(null);
  const [customerName, setCustomerName] = useState<string>("");
  const [shareToken,   setShareToken]   = useState<string>("");
  const [payUrl,       setPayUrl]       = useState<string>("");
  const [errorMsg,     setErrorMsg]     = useState<string>("");
  const [paidAmount,   setPaidAmount]   = useState<number>(0);
  const [paidCurrency, setPaidCurrency] = useState<string>("");
  const [cashLoading,  setCashLoading]  = useState(false);
  const [downloading,  setDownloading]  = useState<string | null>(null); // current mode being downloaded

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef<number>(0);

  const invoicesApi = useMemo(
    () => (token ? createInvoicesApi(token) : null),
    [token]
  );

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (pollToken: string, amount: number, currency: string) => {
      if (pollTimerRef.current) return;
      pollCountRef.current = 0;

      pollTimerRef.current = setInterval(async () => {
        pollCountRef.current += 1;
        if (pollCountRef.current > POLL_MAX_TIMES) {
          stopPolling();
          setPageState("timeout");
          return;
        }
        try {
          const res = await apiGet<PollResponse>(
            `/api/v1/invoices/pay/${encodeURIComponent(pollToken)}`,
            { skip401Redirect: true }
          );
          if (res?.success && res.data?.status?.toLowerCase() === "paid") {
            stopPolling();
            setPaidAmount(res.data.amount ?? amount);
            setPaidCurrency(res.data.currency ?? currency);
            setPageState("paid");
          }
        } catch {
          // silently ignore; timeout handles giving up
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  useEffect(() => {
    if (!invoiceId || !businessId || !token) return;
    let cancelled = false;

    async function init() {
      try {
        const invRes = await apiGet<{ success: boolean; data: InvoiceDetail }>(
          `/api/v1/invoices/${invoiceId}?businessId=${encodeURIComponent(businessId!)}`,
          { token }
        );
        if (cancelled) return;
        const inv = invRes?.data ?? (invRes as unknown as InvoiceDetail);
        setInvoice(inv ?? null);

        if (inv?.customerId) {
          try {
            const custRes = await apiGet<{ success: boolean; data: { name: string } }>(
              `/api/v1/customers/${inv.customerId}?businessId=${encodeURIComponent(businessId!)}`,
              { token }
            );
            if (!cancelled) setCustomerName(custRes?.data?.name ?? "");
          } catch { /* optional */ }
        }

        // If already paid (e.g. refreshed after payment), skip to paid state directly
        if (inv?.status === "paid") {
          setPaidAmount(inv.amount);
          setPaidCurrency(inv.currency);
          setPageState("paid");
          return;
        }

        const shareRes = await apiPost<ShareResponse>(
          `/api/v1/invoices/${invoiceId}/share`,
          { businessId },
          { token }
        );
        if (cancelled) return;

        const shareData = shareRes?.data;
        if (!shareData?.token || !shareData?.payUrl) throw new Error("Could not generate payment link");

        setShareToken(shareData.token);
        setPayUrl(shareData.payUrl);
        setPageState("ready");
        startPolling(shareData.token, inv?.amount ?? 0, inv?.currency ?? "");
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(e instanceof Error ? e.message : "Failed to load invoice");
          setPageState("error");
        }
      }
    }

    void init();
    return () => { cancelled = true; stopPolling(); };
  }, [invoiceId, businessId, token, startPolling, stopPolling]);

  // ── Mark paid (cash) ────────────────────────────────────────────────────────
  const handleMarkCash = async () => {
    if (!invoicesApi || !invoice || !businessId) return;
    setCashLoading(true);
    try {
      await invoicesApi.markPaidCash(invoiceId, businessId);
      stopPolling();
      setPaidAmount(invoice.amount);
      setPaidCurrency(invoice.currency);
      setPageState("paid");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to mark as paid");
    } finally {
      setCashLoading(false);
    }
  };

  // ── Download PDF ─────────────────────────────────────────────────────────────
  const handleDownload = async (mode: "receipt" | "thermal") => {
    if (!invoicesApi) return;
    setDownloading(mode);
    try {
      await invoicesApi.downloadPdf(invoiceId, businessId!, mode);
    } catch {
      // silent — browser handles the download
    } finally {
      setDownloading(null);
    }
  };

  // ── States ───────────────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-dark-4 dark:text-dark-6">{t("pos.settingUp")}</p>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-dark dark:text-white">{t("pos.error")}</h2>
          <p className="mb-6 text-dark-4 dark:text-dark-6">{errorMsg}</p>
        </div>
        <Link href="/invoices" className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90">
          {t("pos.backToInvoices")}
        </Link>
      </div>
    );
  }

  if (pageState === "timeout") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <svg className="h-8 w-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-dark dark:text-white">{t("pos.paymentNotReceived")}</h2>
          <p className="mb-6 text-dark-4 dark:text-dark-6">{t("pos.timeoutMessage")}</p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            onClick={() => {
              if (shareToken && invoice) {
                pollCountRef.current = 0;
                startPolling(shareToken, invoice.amount, invoice.currency);
                setPageState("ready");
              }
            }}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            {t("pos.retryQr")}
          </button>
          <button
            type="button"
            onClick={handleMarkCash}
            disabled={cashLoading}
            className="rounded-lg border border-stroke bg-white px-6 py-2.5 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white disabled:opacity-70"
          >
            {cashLoading ? "…" : `💵 ${t("pos.collectedCash")}`}
          </button>
        </div>
        <Link href="/invoices" className="text-sm font-medium text-primary hover:underline">
          {t("pos.backToInvoices")}
        </Link>
      </div>
    );
  }

  // ── Paid state ────────────────────────────────────────────────────────────────
  if (pageState === "paid") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 py-8">
        {/* Success checkmark */}
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg className="h-12 w-12 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div className="text-center">
          <h2 className="mb-1 text-2xl font-bold text-green-700 dark:text-green-400">{t("pos.paymentConfirmed")}</h2>
          {customerName && (
            <p className="text-sm text-dark-4 dark:text-dark-6">{customerName}</p>
          )}
          <p className="mt-1 text-4xl font-bold text-dark dark:text-white">
            <Price amount={paidAmount} currency={paidCurrency} />
          </p>
        </div>

        {/* Receipt options */}
        <div className="w-full max-w-xs rounded-2xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-dark-4 dark:text-dark-6">
            {t("pos.printDownload")}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleDownload("receipt")}
              disabled={downloading === "receipt"}
              className="flex items-center justify-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2.5 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white disabled:opacity-60"
            >
              {downloading === "receipt" ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              {t("pos.receiptA4")}
            </button>

            <button
              type="button"
              onClick={() => handleDownload("thermal")}
              disabled={downloading === "thermal"}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {downloading === "thermal" ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              )}
              {t("pos.thermalTicket")}
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setPageState("ready")}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("pos.newTransaction")}
          </button>
          <Link href="/invoices" className="text-sm font-medium text-dark-4 hover:underline dark:text-dark-6">
            {t("pos.backToInvoices")}
          </Link>
        </div>
      </div>
    );
  }

  // ── Ready state — QR + cash option ───────────────────────────────────────────
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 py-8">
      <div className="w-full max-w-sm">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-dark-4 hover:text-primary dark:text-dark-6 dark:hover:text-primary"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("pos.backToInvoices")}
        </Link>
      </div>

      <div className="w-full max-w-sm rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
        {/* Header */}
        <div className="mb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-dark-4 dark:text-dark-6">
            {t("pos.terminal")}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-dark dark:text-white">
            {invoice ? <Price amount={invoice.amount} currency={invoice.currency} /> : "—"}
          </h1>
          {customerName && (
            <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">{customerName}</p>
          )}
        </div>

        {/* QR Code */}
        <div className="flex justify-center py-4">
          {payUrl ? (
            <div className="rounded-xl border-4 border-stroke p-3 dark:border-dark-3">
              <QRCodeSVG value={payUrl} size={260} level="M" includeMargin={false} />
            </div>
          ) : (
            <div className="flex h-[260px] w-[260px] items-center justify-center rounded-xl border-4 border-stroke dark:border-dark-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>

        {/* Waiting indicator */}
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            {t("pos.waitingForPayment")}
          </div>
          <p className="text-xs text-dark-4 dark:text-dark-6">
            {t("pos.clientScansQr")}
          </p>
        </div>

        {/* Divider */}
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-stroke dark:bg-dark-3" />
          <span className="text-xs text-dark-4 dark:text-dark-6">{t("pos.or")}</span>
          <div className="h-px flex-1 bg-stroke dark:bg-dark-3" />
        </div>

        {/* Cash payment button */}
        <button
          type="button"
          onClick={handleMarkCash}
          disabled={cashLoading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white disabled:opacity-60"
        >
          {cashLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-dark border-t-transparent dark:border-white" />
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          )}
          {t("pos.collectedCash")}
        </button>
      </div>
    </div>
  );
}
