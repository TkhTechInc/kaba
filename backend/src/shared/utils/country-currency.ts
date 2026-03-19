import type { Tier } from '@/domains/features/feature.types';

/** XOF countries (West African CFA franc) */
const XOF_COUNTRIES = new Set(['BJ', 'SN', 'CI', 'TG', 'ML', 'NE', 'BF']);

/**
 * Returns a default country code for a given currency when business has none.
 * Used by payment config (KkiaPay, MoMo) so TKH Payments can return correct options.
 * - XOF → BJ (Benin)
 * - XAF → CM (Cameroon)
 * - GNF → GN (Guinea)
 */
export function getCountryForCurrency(currency: string): string | undefined {
  const cur = (currency ?? '').toUpperCase().trim();
  if (cur === 'XOF') return 'BJ';
  if (cur === 'XAF') return 'CM';
  if (cur === 'GNF') return 'GN';
  return undefined;
}

/**
 * Returns the currency code for a given country code.
 * - NG → NGN
 * - GH → GHS
 * - BJ, SN, CI, TG, ML, NE, BF → XOF
 * - CM → XAF
 * - Unknown → XOF (default)
 */
export function getCurrencyForCountry(countryCode: string): string {
  const code = (countryCode ?? '').toUpperCase().trim();
  if (code === 'NG') return 'NGN';
  if (code === 'GH') return 'GHS';
  if (XOF_COUNTRIES.has(code)) return 'XOF';
  if (code === 'CM') return 'XAF';
  return 'XOF';
}

/**
 * Returns the effective currency for a business.
 * Priority: country-derived currency > business.currency > XOF.
 */
export function getBusinessCurrency(business: { countryCode?: string; currency?: string }): string {
  const fromCountry = business.countryCode?.trim()
    ? getCurrencyForCountry(business.countryCode!)
    : undefined;
  return fromCountry ?? business.currency ?? 'XOF';
}

const XOF_PRICES: Record<Tier, number | null> = {
  free: 0,
  starter: 2500,
  pro: 7500,
  enterprise: 25000,
};

const XAF_PRICES: Record<Tier, number | null> = {
  free: 0,
  starter: 2500,
  pro: 7500,
  enterprise: 25000,
};

/**
 * Returns country-based plan prices per tier.
 * - NG: NGN 5000/15000/50000
 * - GH: GHS 50/150/500
 * - XOF countries (BJ, SN, CI, TG, ML, NE, BF): 2500/7500/25000
 * - CM (XAF): 2500/7500/25000 (same as XOF)
 * - Unknown: XOF prices (fallback)
 */
export function getPlanPricesForCountry(countryCode: string): Record<Tier, number | null> {
  const code = (countryCode ?? '').toUpperCase().trim();
  if (code === 'NG') {
    return { free: 0, starter: 5000, pro: 15000, enterprise: 50000 };
  }
  if (code === 'GH') {
    return { free: 0, starter: 50, pro: 150, enterprise: 500 };
  }
  if (XOF_COUNTRIES.has(code)) {
    return { ...XOF_PRICES };
  }
  if (code === 'CM') {
    return { ...XAF_PRICES };
  }
  return { ...XOF_PRICES };
}
