import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { DatabaseError } from '@/shared/errors/DomainError';
import type { Tier } from '@/domains/features/feature.types';

export interface PlanPaymentRecord {
  token: string;
  businessId: string;
  targetTier: Tier;
  amount: number;
  currency: string;
  expiresAt: string;
  createdAt: string;
}

const PK_PREFIX = 'PLAN_PAYMENT#';

/**
 * Repository for plan payment tokens. Uses ledger table.
 * pk=PLAN_PAYMENT#{token}, sk=META
 */
export class PlanPaymentRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async create(record: PlanPaymentRecord): Promise<PlanPaymentRecord> {
    const ttlEpoch = Math.floor(new Date(record.expiresAt).getTime() / 1000);
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: `${PK_PREFIX}${record.token}`,
            sk: 'META',
            entityType: 'PLAN_PAYMENT',
            ...record,
            ttl: ttlEpoch,
          },
        })
      );
      return record;
    } catch (e) {
      throw new DatabaseError('Create plan payment token failed', e);
    }
  }

  async getByToken(token: string): Promise<PlanPaymentRecord | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `${PK_PREFIX}${token}`,
            sk: 'META',
          },
        })
      );
      if (!result.Item) return null;
      const item = result.Item;
      const tokenVal = String(item.token ?? '');
      const businessId = String(item.businessId ?? '');
      if (!tokenVal || !businessId) return null;
      return {
        token: tokenVal,
        businessId,
        targetTier: (item.targetTier ?? 'starter') as Tier,
        amount: Number(item.amount ?? 0),
        currency: String(item.currency ?? 'XOF'),
        expiresAt: String(item.expiresAt ?? ''),
        createdAt: String(item.createdAt ?? ''),
      };
    } catch (e) {
      throw new DatabaseError('Get plan payment token failed', e);
    }
  }
}
