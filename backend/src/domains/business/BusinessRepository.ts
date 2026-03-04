import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { DatabaseError } from '@/shared/errors/DomainError';
import type { Business, BusinessType, TaxRegime } from '@/domains/ledger/models/Business';
import type { Tier } from '@/domains/features/feature.types';

export interface UpdateOnboardingInput {
  name?: string;
  businessType?: BusinessType;
  countryCode?: string;
  currency?: string;
  taxRegime?: TaxRegime;
  address?: string;
  phone?: string;
  fiscalYearStart?: number;
  onboardingComplete?: boolean;
}

const SK_META = 'META';

export class BusinessRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async getById(businessId: string): Promise<Business | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: SK_META },
        }),
      );
      if (!result.Item) return null;
      return this.mapFromDynamoDB(result.Item);
    } catch (e) {
      throw new DatabaseError('Get business failed', e);
    }
  }

  async getOrCreate(businessId: string, defaultTier: Tier = 'free'): Promise<Business> {
    const existing = await this.getById(businessId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const business: Business = {
      id: businessId,
      tier: defaultTier,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(business),
          ConditionExpression: 'attribute_not_exists(sk)',
        }),
      );
      return business;
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'ConditionalCheckFailedException') {
        const retry = await this.getById(businessId);
        if (retry) return retry;
      }
      throw new DatabaseError('Create business failed', e);
    }
  }

  async updateTier(businessId: string, tier: Tier): Promise<Business> {
    const existing = await this.getOrCreate(businessId, tier);
    const now = new Date().toISOString();
    const updated: Business = { ...existing, tier, updatedAt: now };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(updated),
        }),
      );
      return updated;
    } catch (e) {
      throw new DatabaseError('Update business tier failed', e);
    }
  }

  async updateOnboarding(
    businessId: string,
    input: UpdateOnboardingInput,
  ): Promise<Business> {
    const existing = await this.getOrCreate(businessId, 'free');
    const now = new Date().toISOString();
    const updated: Business = {
      ...existing,
      ...input,
      updatedAt: now,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(updated),
        }),
      );
      return updated;
    } catch (e) {
      throw new DatabaseError('Update onboarding failed', e);
    }
  }

  private mapToDynamoDB(b: Business): Record<string, unknown> {
    return {
      pk: b.id,
      sk: SK_META,
      entityType: 'BUSINESS',
      id: b.id,
      tier: b.tier,
      name: b.name,
      countryCode: b.countryCode,
      currency: b.currency,
      organizationId: b.organizationId,
      businessType: b.businessType,
      taxRegime: b.taxRegime,
      address: b.address,
      phone: b.phone,
      fiscalYearStart: b.fiscalYearStart,
      onboardingComplete: b.onboardingComplete,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): Business {
    return {
      id: String(item.id ?? item.pk ?? ''),
      tier: (item.tier as Tier) ?? 'free',
      name: item.name != null ? String(item.name) : undefined,
      countryCode: item.countryCode != null ? String(item.countryCode) : undefined,
      currency: item.currency != null ? String(item.currency) : undefined,
      organizationId: item.organizationId != null ? String(item.organizationId) : undefined,
      businessType: item.businessType != null ? (item.businessType as BusinessType) : undefined,
      taxRegime: item.taxRegime != null ? String(item.taxRegime) : undefined,
      address: item.address != null ? String(item.address) : undefined,
      phone: item.phone != null ? String(item.phone) : undefined,
      fiscalYearStart: item.fiscalYearStart != null ? Number(item.fiscalYearStart) : undefined,
      onboardingComplete: item.onboardingComplete === true,
      createdAt: String(item.createdAt ?? ''),
      updatedAt: String(item.updatedAt ?? ''),
    };
  }
}
