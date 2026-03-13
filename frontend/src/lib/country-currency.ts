/**
 * Maps ISO 3166-1 alpha-2 country codes to their primary currency.
 * Same mapping as backend. Default XOF for West Africa when unknown.
 * NG: NGN, GH: GHS, BJ/SN/CI/TG/ML/NE/BF: XOF, CM: XAF.
 */
export const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  NG: "NGN",
  GH: "GHS",
  BJ: "XOF",
  BF: "XOF",
  CI: "XOF",
  ML: "XOF",
  NE: "XOF",
  SN: "XOF",
  TG: "XOF",
  CM: "XAF",
};

const COUNTRY_CURRENCY = COUNTRY_DEFAULT_CURRENCY;

/**
 * Get currency for a country code. Returns XOF as default for unknown countries.
 */
export function getCurrencyForCountry(countryCode: string): string {
  const code = (countryCode ?? "").trim().toUpperCase();
  return COUNTRY_CURRENCY[code] ?? "XOF";
}
