import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DatabaseError } from '@/shared/errors/DomainError';

const SK_META = 'META';
const TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface IdempotencyRecord {
  statusCode: number;
  body: unknown;
  createdAt: string;
}

export class IdempotencyRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async get(key: string): Promise<IdempotencyRecord | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: key, sk: SK_META },
        }),
      );
      if (!result.Item) return null;
      const status = String(result.Item.status ?? '');
      if (status === 'processing') return null;
      return {
        statusCode: Number(result.Item.statusCode ?? 200),
        body: result.Item.body,
        createdAt: String(result.Item.createdAt ?? ''),
      };
    } catch (e) {
      throw new DatabaseError('Get idempotency record failed', e);
    }
  }

  /**
   * Claim the idempotency key before running the handler.
   * Returns true if we claimed it, false if another request already has it.
   */
  async claim(key: string): Promise<boolean> {
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: key,
            sk: SK_META,
            entityType: 'IDEMPOTENCY',
            status: 'processing',
            createdAt: now,
            ttl,
          },
          ConditionExpression: 'attribute_not_exists(pk)',
        }),
      );
      return true;
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name === 'ConditionalCheckFailedException') return false;
      throw new DatabaseError('Claim idempotency key failed', e);
    }
  }

  /**
   * Release a claimed key so a retry can run (e.g. when handler throws).
   */
  async release(key: string): Promise<void> {
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { pk: key, sk: SK_META },
          ConditionExpression: '#s = :processing',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':processing': 'processing' },
        }),
      );
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name === 'ConditionalCheckFailedException') return;
      throw new DatabaseError('Release idempotency key failed', e);
    }
  }

  async save(key: string, statusCode: number, body: unknown): Promise<void> {
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: key,
            sk: SK_META,
            entityType: 'IDEMPOTENCY',
            status: 'completed',
            statusCode,
            body,
            createdAt: now,
            ttl,
          },
        }),
      );
    } catch (e) {
      throw new DatabaseError('Save idempotency record failed', e);
    }
  }
}
