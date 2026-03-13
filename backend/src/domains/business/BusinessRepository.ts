import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { DatabaseError, ValidationError } from '@/shared/errors/DomainError';
import { getCurrencyForCountry } from '@/shared/utils/country-currency';
import type { Business, BusinessType, LegalStatus, TaxRegime } from '@/domains/ledger/models/Business';
import type { Tier } from '@/domains/features/feature.types';

export interface UpdateOnboardingInput {
  name?: string;
  businessType?: BusinessType;
  countryCode?: string;
  currency?: string;
  taxRegime?: TaxRegime;
  taxId?: string;
  legalStatus?: LegalStatus;
  rccm?: string;
  address?: string;
  phone?: string;
  fiscalYearStart?: number;
  onboardingComplete?: boolean;
  trustScore?: number;
  trustScoredAt?: string;
  marketDayCycle?: number;
  organizationId?: string;
  slug?: string;
  logoUrl?: string;
  description?: string;
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

  /**
   * Lock a fiscal period (OHADA-compliant month-end close).
   * Period format: "YYYY-MM" (e.g. "2026-01").
   * Idempotent — locking an already-locked period is a no-op.
   */
  async lockPeriod(businessId: string, period: string): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: SK_META },
          UpdateExpression: 'ADD lockedPeriods :period',
          ExpressionAttributeValues: {
            ':period': new Set([period]),
          },
          ConditionExpression: 'attribute_exists(pk)',
        })
      );
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'ConditionalCheckFailedException') {
        throw new Error(`Business ${businessId} not found`);
      }
      throw new DatabaseError('Lock period failed', e);
    }
  }

  /** Returns sorted list of locked periods ("YYYY-MM") for a business. */
  async getLockedPeriods(businessId: string): Promise<string[]> {
    const business = await this.getById(businessId);
    return business?.lockedPeriods?.sort() ?? [];
  }

  /**
   * List all businesses belonging to an organization.
   * Uses organizationId-pk-index GSI when ACTIVE; falls back to a filtered
   * Scan while the GSI is still being built (CREATING state).
   */
  async listByOrganization(organizationId: string): Promise<import('@/domains/ledger/models/Business').Business[]> {
    const items: import('@/domains/ledger/models/Business').Business[] = [];
    let lastKey: Record<string, unknown> | undefined;

    try {
      do {
        const result = await this.docClient.send(
          new QueryCommand({
            TableName: this.tableName,
            IndexName: 'organizationId-pk-index',
            KeyConditionExpression: 'organizationId = :orgId',
            ExpressionAttributeValues: {
              ':orgId': organizationId,
            },
            ...(lastKey && { ExclusiveStartKey: lastKey }),
          })
        );
        const batch = (result.Items ?? [])
          .filter((item) => item.sk === SK_META)
          .map((item) => this.mapFromDynamoDB(item));
        items.push(...batch);
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);

      return items;
    } catch (e: unknown) {
      const errMsg = (e as { message?: string })?.message ?? '';
      if (!errMsg.includes('does not have the specified index')) throw e;

      // GSI not yet active — fall back to a Scan with filter
      const fallback: import('@/domains/ledger/models/Business').Business[] = [];
      let scanKey: Record<string, unknown> | undefined;
      do {
        const result = await this.docClient.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: 'organizationId = :orgId AND sk = :meta',
            ExpressionAttributeValues: {
              ':orgId': organizationId,
              ':meta': SK_META,
            },
            ...(scanKey && { ExclusiveStartKey: scanKey }),
          })
        );
        fallback.push(...(result.Items ?? []).map((item) => this.mapFromDynamoDB(item)));
        scanKey = result.LastEvaluatedKey;
      } while (scanKey);

      return fallback;
    }
  }

  async updateOnboarding(
    businessId: string,
    input: UpdateOnboardingInput,
  ): Promise<Business> {
    const existing = await this.getOrCreate(businessId, 'free');
    if (input.slug != null && input.slug.trim() !== '') {
      const taken = await this.isSlugTaken(input.slug.trim(), businessId);
      if (taken) {
        throw new ValidationError('This store URL is already taken. Please choose another.');
      }
    }
    const now = new Date().toISOString();
    const slugValue = input.slug != null ? String(input.slug).trim() : existing.slug;
    const countryCode = input.countryCode ?? existing.countryCode;
    const currency =
      input.currency?.trim() ||
      existing.currency?.trim() ||
      (countryCode?.trim() ? getCurrencyForCountry(countryCode) : undefined);
    const updated: Business = {
      ...existing,
      ...input,
      slug: slugValue || undefined,
      currency: currency ?? input.currency ?? existing.currency,
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

  /**
   * Remove a business from its organization by clearing the organizationId field.
   * The business continues to exist as a standalone entity.
   */
  async unlinkFromOrganization(businessId: string): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: SK_META },
          UpdateExpression: 'REMOVE organizationId SET updatedAt = :now',
          ExpressionAttributeValues: {
            ':now': new Date().toISOString(),
          },
          ConditionExpression: 'attribute_exists(pk)',
        }),
      );
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'ConditionalCheckFailedException') {
        throw new Error(`Business ${businessId} not found`);
      }
      throw new DatabaseError('Unlink from organization failed', e);
    }
  }

  /**
   * Check if a slug is already used by another business.
   * Use excludeBusinessId when the current business is keeping its own slug.
   */
  async isSlugTaken(slug: string, excludeBusinessId?: string): Promise<boolean> {
    if (!slug?.trim()) return false;
    const existing = await this.getBySlug(slug);
    if (!existing) return false;
    return existing.id !== excludeBusinessId;
  }

  /**
   * Look up a business by its public slug.
   * Uses a Scan with FilterExpression — suitable until a GSI on `slug` is added.
   */
  async getBySlug(slug: string): Promise<Business | null> {
    try {
      let lastKey: Record<string, unknown> | undefined;
      do {
        const result = await this.docClient.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: '#slug = :slug AND sk = :meta',
            ExpressionAttributeNames: { '#slug': 'slug' },
            ExpressionAttributeValues: {
              ':slug': slug,
              ':meta': SK_META,
            },
            ...(lastKey && { ExclusiveStartKey: lastKey }),
          }),
        );
        const items = result.Items ?? [];
        if (items.length > 0) return this.mapFromDynamoDB(items[0]);
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);
      return null;
    } catch (e) {
      throw new DatabaseError('Get business by slug failed', e);
    }
  }

  /**
   * Get sector benchmark: total business count and average trust score across all businesses.
   * Used for trust score comparison. Paginates through all businesses.
   */
  async getSectorBenchmark(): Promise<{ businessCount: number; averageTrustScore: number }> {
    let totalCount = 0;
    let sumTrustScore = 0;
    let countWithScore = 0;
    let lastKey: Record<string, unknown> | undefined;

    try {
      do {
        const result = await this.docClient.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: 'sk = :meta',
            ExpressionAttributeValues: { ':meta': SK_META },
            ProjectionExpression: 'trustScore',
            ...(lastKey && { ExclusiveStartKey: lastKey }),
          }),
        );
        const items = result.Items ?? [];
        totalCount += items.length;
        for (const item of items) {
          if (item.trustScore != null && typeof item.trustScore === 'number') {
            sumTrustScore += item.trustScore;
            countWithScore += 1;
          }
        }
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);

      const averageTrustScore = countWithScore > 0 ? Math.round(sumTrustScore / countWithScore) : 62;
      return { businessCount: totalCount, averageTrustScore };
    } catch (e) {
      return { businessCount: 0, averageTrustScore: 62 };
    }
  }

  async updateTrustScore(businessId: string, score: number): Promise<Business> {
    const now = new Date().toISOString();
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: SK_META },
          UpdateExpression: 'SET trustScore = :score, trustScoredAt = :scoredAt, updatedAt = :now',
          ExpressionAttributeValues: {
            ':score': score,
            ':scoredAt': now,
            ':now': now,
          },
          ConditionExpression: 'attribute_exists(pk)',
        }),
      );
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'ConditionalCheckFailedException') {
        throw new Error(`Business ${businessId} not found`);
      }
      throw new DatabaseError('Update trust score failed', e);
    }
    const updated = await this.getById(businessId);
    if (!updated) throw new DatabaseError('Business not found after trust score update', null);
    return updated;
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
      taxId: b.taxId,
      legalStatus: b.legalStatus,
      rccm: b.rccm,
      address: b.address,
      phone: b.phone,
      fiscalYearStart: b.fiscalYearStart,
      onboardingComplete: b.onboardingComplete,
      trustScore: b.trustScore ?? undefined,
      trustScoredAt: b.trustScoredAt ?? undefined,
      marketDayCycle: b.marketDayCycle ?? undefined,
      slug: b.slug ?? undefined,
      logoUrl: b.logoUrl ?? undefined,
      description: b.description ?? undefined,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      ...(b.lockedPeriods?.length ? { lockedPeriods: b.lockedPeriods } : {}),
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): Business {
    let lockedPeriods: string[] | undefined;
    if (item.lockedPeriods) {
      // DynamoDB stores string sets as DocumentClient Set objects
      const raw = item.lockedPeriods;
      if (raw instanceof Set) {
        lockedPeriods = Array.from(raw) as string[];
      } else if (raw && typeof raw === 'object' && 'values' in raw) {
        lockedPeriods = Array.from((raw as { values: Iterable<string> }).values);
      } else if (Array.isArray(raw)) {
        lockedPeriods = raw as string[];
      }
    }

    return {
      id: String(item.id ?? item.pk ?? ''),
      tier: (item.tier as Tier) ?? 'free',
      name: item.name != null ? String(item.name) : undefined,
      countryCode: item.countryCode != null ? String(item.countryCode) : undefined,
      currency: item.currency != null ? String(item.currency) : undefined,
      organizationId: item.organizationId != null ? String(item.organizationId) : undefined,
      businessType: item.businessType != null ? (item.businessType as BusinessType) : undefined,
      taxRegime: item.taxRegime != null ? String(item.taxRegime) : undefined,
      taxId: item.taxId != null ? String(item.taxId) : undefined,
      legalStatus: item.legalStatus != null ? (item.legalStatus as LegalStatus) : undefined,
      rccm: item.rccm != null ? String(item.rccm) : undefined,
      address: item.address != null ? String(item.address) : undefined,
      phone: item.phone != null ? String(item.phone) : undefined,
      fiscalYearStart: item.fiscalYearStart != null ? Number(item.fiscalYearStart) : undefined,
      onboardingComplete: item.onboardingComplete === true,
      lockedPeriods,
      trustScore: item.trustScore != null ? Number(item.trustScore) : undefined,
      trustScoredAt: item.trustScoredAt != null ? String(item.trustScoredAt) : undefined,
      marketDayCycle: item.marketDayCycle != null ? Number(item.marketDayCycle) : undefined,
      slug: item.slug != null ? String(item.slug) : undefined,
      logoUrl: item.logoUrl != null ? String(item.logoUrl) : undefined,
      description: item.description != null ? String(item.description) : undefined,
      createdAt: String(item.createdAt ?? ''),
      updatedAt: String(item.updatedAt ?? ''),
    };
  }
}
