/**
 * Maps backend payment-link errors to user-friendly message keys.
 * Logs raw errors for developers; returns i18n keys for end users.
 */
export type PaymentLinkErrorKey =
  | "invoiceDetail.paymentLinkErrorUnavailable"
  | "invoiceDetail.paymentLinkErrorPaid"
  | "invoiceDetail.paymentLinkErrorCancelled";

export function toPaymentLinkErrorKey(rawError: string): PaymentLinkErrorKey {
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "test") {
    console.error("[payment-link] Backend error:", rawError);
  }
  const lower = rawError.toLowerCase();
  if (lower.includes("paid invoice") || lower.includes("already paid")) {
    return "invoiceDetail.paymentLinkErrorPaid";
  }
  if (lower.includes("cancelled invoice") || lower.includes("cancelled")) {
    return "invoiceDetail.paymentLinkErrorCancelled";
  }
  return "invoiceDetail.paymentLinkErrorUnavailable";
}
