import { BadRequestException, Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Tier, FeatureKey, FeatureConfigMap, FeatureConfig } from './feature.types';

const VALID_TIERS: Tier[] = ['free', 'starter', 'pro', 'enterprise'];

const DEFAULT_FEATURES: FeatureConfigMap = {
  ledger: { enabled: true, tiers: ['free', 'starter', 'pro', 'enterprise'], limits: { free: 50, starter: 500, pro: 5000, enterprise: 100000 } },
  invoicing: { enabled: true, tiers: ['starter', 'pro', 'enterprise'] },
  payment_links: { enabled: true, tiers: ['starter', 'pro', 'enterprise'] },
  receipts: { enabled: true, tiers: ['pro', 'enterprise'] },
  receipts_s3: { enabled: true, tiers: ['pro', 'enterprise'] },
  reports: { enabled: true, tiers: ['free', 'starter', 'pro', 'enterprise'] },
  reports_pdf: { enabled: true, tiers: ['pro', 'enterprise'] },
  ai_query: { enabled: true, tiers: ['starter', 'pro', 'enterprise'], limits: { starter: 10, pro: 100, enterprise: 1000 } },
  ai_voice: { enabled: true, tiers: ['pro', 'enterprise'] },
  ai_loan_readiness: { enabled: true, tiers: ['pro', 'enterprise'] },
  sms_receipts: { enabled: true, tiers: ['pro', 'enterprise'] },
  tax: { enabled: true, tiers: ['starter', 'pro', 'enterprise'] },
  webhooks: { enabled: true, tiers: ['pro', 'enterprise'] },
  api_keys: { enabled: true, tiers: ['pro', 'enterprise'] },
  debt_tracker: { enabled: true, tiers: ['starter', 'pro', 'enterprise'] },
  debt_reminders: { enabled: true, tiers: ['pro', 'enterprise'], limits: { pro: 50, enterprise: 500 } },
  receipt_pdf_whatsapp: { enabled: true, tiers: ['pro', 'enterprise'] },
  inventory_lite: { enabled: true, tiers: ['starter', 'pro', 'enterprise'] },
  mobile_money_recon: { enabled: true, tiers: ['pro', 'enterprise'], limits: { pro: 100, enterprise: 1000 } },
  sales_role: { enabled: true, tiers: ['free', 'starter', 'pro', 'enterprise'] },
  credit_ready_pdf: { enabled: true, tiers: ['pro', 'enterprise'] },
  tax_ohada: { enabled: true, tiers: ['pro', 'enterprise'] },
  whatsapp_bot: { enabled: true, tiers: ['enterprise'] },
  image_compression: { enabled: true, tiers: ['free', 'starter', 'pro', 'enterprise'] },
  trust_score: { enabled: true, tiers: ['starter', 'pro', 'enterprise'] },
  trust_share: { enabled: true, tiers: ['starter', 'pro', 'enterprise'] },
  trust_lookup: { enabled: true, tiers: ['pro', 'enterprise'] },
  whatsapp_invoice_delivery: { enabled: true, tiers: ['pro', 'enterprise'] },
};

@Injectable()
export class FeatureService {
  private readonly features: FeatureConfigMap;

  constructor(@Optional() @Inject(ConfigService) config: ConfigService | null) {
    const overrides = config?.get<Partial<FeatureConfigMap>>('features') || {};
    this.features = { ...DEFAULT_FEATURES, ...overrides };
  }

  /** True when launch promo is enabled and current date is before end date. */
  private isLaunchPromoActive(): boolean {
    const promo = process.env['LAUNCH_PROMO_ENABLED'] === 'true';
    if (!promo) return false;
    const endDate = process.env['LAUNCH_PROMO_END_DATE']?.trim();
    if (!endDate) return true;
    const today = new Date().toISOString().slice(0, 10);
    return today <= endDate;
  }

  /** Check if a feature is enabled for the given tier. */
  isEnabled(featureKey: FeatureKey, tier: Tier): boolean {
    const feature = this.features[featureKey];
    if (!feature || !feature.enabled) return false;
    if (this.isLaunchPromoActive()) return true;
    return feature.tiers.includes(tier);
  }

  /** Check if usage is within limit for the feature/tier. Returns true if within limit or no limit. */
  isWithinLimit(
    featureKey: FeatureKey,
    tier: Tier,
    currentUsage: number,
  ): boolean {
    const effectiveTier = this.isLaunchPromoActive() ? 'enterprise' : tier;
    const feature = this.features[featureKey];
    if (!feature?.limits) return true;
    const limit = feature.limits[effectiveTier];
    if (limit == null) return true;
    return currentUsage < limit;
  }

  /** Get the limit for a feature/tier, or undefined if unlimited. */
  getLimit(featureKey: FeatureKey, tier: Tier): number | undefined {
    const effectiveTier = this.isLaunchPromoActive() ? 'enterprise' : tier;
    return this.features[featureKey]?.limits?.[effectiveTier];
  }

  /** Get all features (for admin/config display). */
  getAllFeatures(): FeatureConfigMap {
    return { ...this.features };
  }

  /**
   * Update a feature config at runtime (session-only, no persistence).
   * Merges partial config into existing feature. Validates key exists and tiers are valid.
   */
  updateFeature(key: FeatureKey, config: Partial<FeatureConfig>): FeatureConfig {
    const existing = this.features[key];
    if (!existing) {
      throw new BadRequestException(`Unknown feature key: ${key}`);
    }
    if (config.tiers !== undefined) {
      if (!Array.isArray(config.tiers) || config.tiers.length === 0) {
        throw new BadRequestException('tiers must be a non-empty array');
      }
      const invalid = config.tiers.filter((t: string) => !VALID_TIERS.includes(t as Tier));
      if (invalid.length > 0) {
        throw new BadRequestException(
          `Invalid tier(s): ${invalid.join(', ')}. Valid: ${VALID_TIERS.join(', ')}`,
        );
      }
    }
    const merged: FeatureConfig = {
      enabled: config.enabled ?? existing.enabled,
      tiers: config.tiers ?? existing.tiers,
      limits:
        config.limits !== undefined
          ? { ...existing.limits, ...config.limits }
          : existing.limits,
    };
    this.features[key] = merged;
    return { ...merged };
  }
}
