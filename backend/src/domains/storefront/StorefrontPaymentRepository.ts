import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { DatabaseError } from '@/shared/errors/DomainError';

export interface StorefrontPaymentRecord {
  token: string;
  slug: string;
  businessId: string;
  amount: number;
  currency: string;
  description?: string;
  customerName?: string;
  customerEmail?: string;
  expiresAt: string;
  createdAt: string;
}

const PK_PREFIX = 'STOREFRONT_PAYMENT#';

/**
 * Repository for storefront payment tokens. Uses ledger table.
 * pk=STOREFRONT_PAYMENT#{token}, sk=META
 */
export class StorefrontPaymentRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async create(record: StorefrontPaymentRecord): Promise<StorefrontPaymentRecord> {
    const ttlEpoch = Math.floor(new Date(record.expiresAt).getTime() / 1000);
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: `${PK_PREFIX}${record.token}`,
            sk: 'META',
            entityType: 'STOREFRONT_PAYMENT',
            ...record,
            ttl: ttlEpoch,
          },
        })
      );
      return record;
    } catch (e) {
      throw new DatabaseError('Create storefront payment token failed', e);
    }
  }

  async getByToken(token: string): Promise<StorefrontPaymentRecord | null> {
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
        slug: String(item.slug ?? ''),
        businessId,
        amount: Number(item.amount ?? 0),
        currency: String(item.currency ?? 'XOF'),
        description: item.description ? String(item.description) : undefined,
        customerName: item.customerName ? String(item.customerName) : undefined,
        customerEmail: item.customerEmail ? String(item.customerEmail) : undefined,
        expiresAt: String(item.expiresAt ?? ''),
        createdAt: String(item.createdAt ?? ''),
      };
    } catch (e) {
      throw new DatabaseError('Get storefront payment token failed', e);
    }
  }
}
