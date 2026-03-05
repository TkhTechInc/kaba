import { Injectable } from '@nestjs/common';
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseError } from '@/shared/errors/DomainError';
import { BusinessTrustScoreService } from './BusinessTrustScoreService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';

export interface TrustShareToken {
  token: string;
  businessId: string;
  businessName?: string;
  trustScore: number;
  recommendation: string;
  breakdown: Record<string, number>;
  shareUrl: string;
  expiresAt: string;
  createdAt: string;
}

export interface PublicTrustBadge {
  businessName?: string;
  trustScore: number;
  recommendation: string;
  scoredAt: string;
  expiresAt: string;
  badge: 'gold' | 'silver' | 'bronze' | 'unrated';
}

const SK_PREFIX = 'TRUST_SHARE#';
const TTL_DAYS = 7;

@Injectable()
export class TrustShareService {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly trustScoreService: BusinessTrustScoreService,
    private readonly businessRepository: BusinessRepository,
    private readonly baseUrl: string,
  ) {}

  async getPublicBadge(token: string): Promise<PublicTrustBadge | null> {
    // Token lookup uses a reverse-lookup item stored under pk=TRUST_TOKEN#{token}, sk=META.
    // Populated by generateShareTokenWithLookup.
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: `TRUST_TOKEN#${token}`, sk: 'META' },
        }),
      );
      if (!result.Item) return null;

      const item = result.Item;
      const expiresAt = String(item.expiresAt ?? '');
      if (new Date(expiresAt) < new Date()) return null;

      const score = Number(item.trustScore ?? 0);
      return {
        businessName: item.businessName != null ? String(item.businessName) : undefined,
        trustScore: score,
        recommendation: String(item.recommendation ?? 'poor'),
        scoredAt: String(item.createdAt ?? ''),
        expiresAt,
        badge: score >= 80 ? 'gold' : score >= 60 ? 'silver' : score >= 40 ? 'bronze' : 'unrated',
      };
    } catch (e) {
      throw new DatabaseError('Get trust badge failed', e);
    }
  }

  /** Stores both a primary item (by businessId) and a reverse-lookup item (by token) for public GET. */
  async generateShareTokenWithLookup(businessId: string): Promise<TrustShareToken> {
    const [scoreResult, business] = await Promise.all([
      this.trustScoreService.calculateAndSave(businessId),
      this.businessRepository.getById(businessId),
    ]);

    const token = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const ttlEpoch = Math.floor(now.getTime() / 1000) + TTL_DAYS * 24 * 60 * 60;
    const shareUrl = `${this.baseUrl}/api/v1/trust/view/${token}`;

    const commonPayload = {
      token,
      businessId,
      businessName: business?.name,
      trustScore: scoreResult.trustScore,
      recommendation: scoreResult.recommendation,
      breakdown: scoreResult.breakdown,
      expiresAt,
      createdAt: now.toISOString(),
      ttl: ttlEpoch,
    };

    try {
      await this.docClient.send(new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: { pk: businessId, sk: `${SK_PREFIX}${token}`, entityType: 'TRUST_SHARE', ...commonPayload },
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: { pk: `TRUST_TOKEN#${token}`, sk: 'META', entityType: 'TRUST_TOKEN', ...commonPayload },
            },
          },
        ],
      }));
    } catch (e) {
      throw new DatabaseError('Save trust share token failed', e);
    }

    return {
      token,
      businessId,
      businessName: business?.name,
      trustScore: scoreResult.trustScore,
      recommendation: scoreResult.recommendation,
      breakdown: scoreResult.breakdown as unknown as Record<string, number>,
      shareUrl,
      expiresAt,
      createdAt: now.toISOString(),
    };
  }
}
