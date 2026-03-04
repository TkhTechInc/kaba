import { Injectable, Inject } from '@nestjs/common';
import { MOBILE_MONEY_PARSER } from '../reconciliation.tokens';
import type { IMobileMoneyParser } from '../interfaces/IMobileMoneyParser';
import { LedgerService } from '@/domains/ledger/services/LedgerService';
import { LedgerEntry } from '@/domains/ledger/models/LedgerEntry';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { FeatureService } from '@/domains/features/FeatureService';
import { UsageRepository } from '@/domains/usage/UsageRepository';
import { ValidationError } from '@/shared/errors/DomainError';

export interface MobileMoneyReconResult {
  entry: LedgerEntry;
  parsed: {
    amount: number;
    currency: string;
    date: string;
    type: 'credit' | 'debit';
    reference?: string;
    description?: string;
  };
}

@Injectable()
export class ReconciliationService {
  constructor(
    @Inject(MOBILE_MONEY_PARSER) private readonly parser: IMobileMoneyParser,
    private readonly ledgerService: LedgerService,
    private readonly businessRepo: BusinessRepository,
    private readonly featureService: FeatureService,
    private readonly usageRepo: UsageRepository,
  ) {}

  async reconcileFromSms(
    businessId: string,
    smsText: string,
    userId?: string,
  ): Promise<MobileMoneyReconResult> {
    const business = await this.businessRepo.getOrCreate(businessId, 'free');
    if (!this.featureService.isEnabled('mobile_money_recon', business.tier)) {
      throw new ValidationError('Mobile money reconciliation is not available for your plan');
    }

    const count = await this.usageRepo.getMobileMoneyReconCount(businessId);
    if (!this.featureService.isWithinLimit('mobile_money_recon', business.tier, count)) {
      const limit = this.featureService.getLimit('mobile_money_recon', business.tier);
      throw new ValidationError(
        `Mobile money reconciliation limit reached (${count}/${limit} this month). Upgrade for more.`,
      );
    }

    const parsed = await this.parser.parse(smsText);

    const type = parsed.type === 'credit' ? 'sale' : 'expense';
    const description =
      parsed.description ?? parsed.reference
        ? `Mobile money: ${parsed.reference ?? ''}`
        : 'Mobile money transaction';

    const entry = await this.ledgerService.createEntry(
      {
        businessId,
        type,
        amount: parsed.amount,
        currency: parsed.currency,
        date: parsed.date,
        description: description.trim(),
        category: 'Mobile Money',
      },
      userId,
    );

    await this.usageRepo.incrementMobileMoneyRecon(businessId);

    return { entry, parsed };
  }
}
