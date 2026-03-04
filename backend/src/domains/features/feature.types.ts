/**
 * Tier and feature toggle types for the tiered system.
 */
export type Tier = 'free' | 'starter' | 'pro' | 'enterprise';

export type FeatureKey =
  | 'ledger'
  | 'invoicing'
  | 'payment_links'
  | 'receipts'
  | 'receipts_s3'
  | 'reports'
  | 'reports_pdf'
  | 'ai_query'
  | 'ai_voice'
  | 'ai_loan_readiness'
  | 'sms_receipts'
  | 'tax'
  | 'webhooks'
  | 'api_keys'
  | 'debt_tracker'
  | 'debt_reminders'
  | 'receipt_pdf_whatsapp'
  | 'inventory_lite'
  | 'mobile_money_recon'
  | 'sales_role'
  | 'credit_ready_pdf'
  | 'tax_ohada'
  | 'whatsapp_bot'
  | 'image_compression';

export interface FeatureConfig {
  enabled: boolean;
  tiers: Tier[];
  limits?: Partial<Record<Tier, number>>;
}

export type FeatureConfigMap = Record<FeatureKey, FeatureConfig>;
