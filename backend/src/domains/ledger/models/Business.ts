import type { Tier } from '@/domains/features/feature.types';

export type BusinessType =
  | 'retail'
  | 'restaurant'
  | 'services'
  | 'manufacturing'
  | 'agriculture'
  | 'other';

export type TaxRegime = 'vat' | 'simplified' | 'none' | string;

/**
 * Legal status of the business — drives MECeF applicability and OHADA compliance.
 * - auto_entrepreneur: Micro/informal, not RCCM-registered
 * - sarl: Société à Responsabilité Limitée
 * - sa: Société Anonyme
 * - snc: Société en Nom Collectif
 * - association: Non-profit / association
 * - other: Other legal form
 */
export type LegalStatus = 'auto_entrepreneur' | 'sarl' | 'sa' | 'snc' | 'association' | 'other';

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
  /** Legal structure of the business (auto-entrepreneur, SARL, SA, etc.) */
  legalStatus?: LegalStatus;
  /** RCCM registration number (Registre du Commerce et du Crédit Mobilier) */
  rccm?: string;
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
  /** 0–100 Sika Trust Score for this business (merchant-level). */
  trustScore?: number;
  /** ISO timestamp of when trustScore was last calculated. */
  trustScoredAt?: string;
  /** Market day cycle in days (e.g. 5 for a 5-day periodic market). Used for Market Day Awareness in scoring. */
  marketDayCycle?: number;
  /** URL-friendly identifier for public storefront, e.g. "mama-fashion" */
  slug?: string;
  /** Public URL to the business logo image */
  logoUrl?: string;
  /** Short public description of the business */
  description?: string;
  createdAt: string;
  updatedAt: string;
}
