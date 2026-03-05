import type { Tier } from '@/domains/features/feature.types';

export type BusinessType =
  | 'retail'
  | 'restaurant'
  | 'services'
  | 'manufacturing'
  | 'agriculture'
  | 'other';

export type TaxRegime = 'vat' | 'simplified' | 'none' | string;

export interface Business {
  id: string;
  name?: string;
  /** e.g. retail, restaurant, services */
  businessType?: BusinessType;
  countryCode?: string;
  currency?: string;
  tier: Tier;
  /** Optional tax regime for the business */
  taxRegime?: TaxRegime;
  /** IFU (Benin) or NCC (Côte d'Ivoire) — required for fiscal certification */
  taxId?: string;
  /** Business address for invoices/receipts */
  address?: string;
  /** Business phone for receipts/contact */
  phone?: string;
  /** Fiscal year start month (1–12) for reporting */
  fiscalYearStart?: number;
  /** Optional organization for grouping; business can exist without org (single-tenant) */
  organizationId?: string;
  /** Set when onboarding wizard is completed */
  onboardingComplete?: boolean;
  /**
   * OHADA-compliant period locking. ISO month strings in "YYYY-MM" format.
   * Once locked, entries in that period cannot be deleted — only reversed.
   */
  lockedPeriods?: string[];
  createdAt: string;
  updatedAt: string;
}
