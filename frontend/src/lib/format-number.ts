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
const CURRENCY_SUFFIX = new Set(["XOF", "XAF"]);

/**
 * Format a price in the given currency. Uses correct position for symbol/code:
 * - Prefix (NGN, GHS, USD): "₦5,000"
 * - Suffix (XOF, XAF, EUR): "2 500 XOF"
 */
export function formatPriceWithCurrency(
  amount: number,
  currency: string,
  suffix = ""
): string {
  const symbol = getCurrencySymbol(currency);
  const formatted = amount.toLocaleString(
    CURRENCY_SUFFIX.has(currency) ? "fr-FR" : "en-US",
    { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  );
  const part = CURRENCY_SUFFIX.has(currency)
    ? `${formatted} ${symbol}`
    : `${symbol}${formatted}`;
  return suffix ? `${part}${suffix}` : part;
}