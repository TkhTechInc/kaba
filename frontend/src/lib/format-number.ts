export function compactFormat(value: number) {
  const formatter = new Intl.NumberFormat("en", {
    notation: "compact",
    compactDisplay: "short",
  });

  return formatter.format(value);
}

export function standardFormat(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Currency code to display symbol. Falls back to code if unknown. */
export function getCurrencySymbol(code: string): string {
  const map: Record<string, string> = {
    NGN: "₦",
    GHS: "₵",
    XOF: "XOF",
    XAF: "XAF",
    USD: "$",
    EUR: "€",
  };
  return map[code] ?? code;
}

/** Currencies where the code goes after the amount (e.g. "2 500 XOF"). */
const CURRENCY_SUFFIX = new Set(["XOF", "XAF", "EUR"]);

/**
 * Format a price in the given currency. Uses correct position for symbol/code:
 * - Prefix (NGN, GHS, USD): "₦5,000.00" or "₦800" when whole number
 * - Suffix (XOF, XAF, EUR): "2 500,00 XOF" or "800 XOF" when whole number
 * Hides decimals when the amount is a whole number (e.g. 800.00 → 800).
 */
export function formatPriceWithCurrency(
  amount: number,
  currency: string,
  suffix = "",
  decimals = 2
): string {
  const symbol = getCurrencySymbol(currency);
  const isWhole = Number.isInteger(amount) || Math.abs(amount % 1) < 1e-9;
  const fracDigits = isWhole ? 0 : decimals;
  const formatted = amount.toLocaleString(
    CURRENCY_SUFFIX.has(currency) ? "fr-FR" : "en-US",
    { minimumFractionDigits: fracDigits, maximumFractionDigits: fracDigits }
  );
  const part = CURRENCY_SUFFIX.has(currency)
    ? `${formatted} ${symbol}`
    : `${symbol}${formatted}`;
  return suffix ? `${part}${suffix}` : part;
}