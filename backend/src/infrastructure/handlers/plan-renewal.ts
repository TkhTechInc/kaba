/**
 * Standalone Lambda handler for sending plan renewal links.
 * Runs on EventBridge schedule (daily at 7am UTC).
 * Finds businesses with subscriptionEndsAt in the next 7 days, creates renewal checkout, sends in-app notification + SMS.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { PlanPaymentRepository } from '@/domains/plans/PlanPaymentRepository';
import { NotificationRepository } from '@/domains/notifications/repositories/NotificationRepository';
import { AwsSnsSmsProvider } from '@/domains/notifications/providers/AwsSnsSmsProvider';
import { getCurrencyForCountry, getPlanPricesForCountry } from '@/shared/utils/country-currency';
import type { Tier } from '@/domains/features/feature.types';

const ledgerTableName = process.env['DYNAMODB_LEDGER_TABLE'] ?? 'Kaba-Ledger-dev';
const frontendUrl = (process.env['FRONTEND_URL'] ?? 'http://localhost:3000').replace(/\/$/, '');
const RENEWAL_DAYS_AHEAD = 7;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const businessRepo = new BusinessRepository(docClient, ledgerTableName);
const planPaymentRepo = new PlanPaymentRepository(docClient, ledgerTableName);
const notificationRepo = new NotificationRepository(docClient, ledgerTableName);
const smsProvider = new AwsSnsSmsProvider(null);

const TIER_NAMES: Record<Tier, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

function buildRenewalSms(businessName: string, planName: string, url: string): string {
  return `Kaba: Your ${planName} plan is renewing soon. Renew now: ${url}`;
}

export async function handler(): Promise<{
  processed: number;
  notifications: number;
  smsSent: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let notifications = 0;
  let smsSent = 0;

  const businesses = await businessRepo.listWithSubscriptionExpiringSoon(RENEWAL_DAYS_AHEAD);
  console.log(`[PlanRenewalHandler] Found ${businesses.length} businesses with subscription expiring in ${RENEWAL_DAYS_AHEAD} days`);

  for (const business of businesses) {
    try {
      const tier = (business.tier ?? 'free') as Tier;
      if (tier === 'free') continue;

      const countryCode = business.countryCode ?? '';
      const prices = getPlanPricesForCountry(countryCode);
      const amount = prices[tier] ?? 0;
      const currency = business.currency ?? getCurrencyForCountry(countryCode);

      if (amount <= 0) continue;

      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await planPaymentRepo.create({
        token,
        businessId: business.id,
        targetTier: tier,
        amount,
        currency,
        expiresAt,
        createdAt: new Date().toISOString(),
      });

      const payUrl = `${frontendUrl}/pay/plan/${token}`;
      const planName = TIER_NAMES[tier];
      const endsAt = business.subscriptionEndsAt ?? '';

      await notificationRepo.create({
        businessId: business.id,
        type: 'plan.expiring',
        title: 'Plan renewal',
        body: `Your ${planName} plan ends on ${new Date(endsAt).toLocaleDateString()}. Renew now to keep your features.`,
        link: payUrl,
        refId: `renewal-${business.id}`,
      });
      notifications++;

      if (business.phone?.trim()) {
        const smsMessage = buildRenewalSms(business.name ?? 'Your business', planName, payUrl);
        const result = await smsProvider.send(business.phone, smsMessage);
        if (result.success) smsSent++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Business ${business.id}: ${msg}`);
      console.error(`[PlanRenewalHandler] Error for business ${business.id}:`, e);
    }
  }

  console.log(
    `[PlanRenewalHandler] Processed ${businesses.length}, notifications ${notifications}, SMS ${smsSent}, errors ${errors.length}`,
  );

  return {
    processed: businesses.length,
    notifications,
    smsSent,
    errors,
  };
}
