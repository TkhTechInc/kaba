import { createHash } from 'crypto';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { DatabaseError } from '@/shared/errors/DomainError';
import type { User } from '../entities/User.entity';

const PK_PREFIX = 'USER#';
const SK_META = 'META';
const EMAIL_PREFIX = 'EMAIL#';
const PHONE_PREFIX = 'PHONE#';

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Derive userId from phone for consistent lookup. Same logic as auth. */
export function getUserIdFromPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  return `user_${createHash('sha256').update(normalized).digest('hex').slice(0, 16)}`;
}

export class UserRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async scanUsers(
    limit = 50,
    lastEvaluatedKey?: Record<string, unknown>,
  ): Promise<{ items: User[]; lastEvaluatedKey?: Record<string, unknown> }> {
    try {
      const result = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'begins_with(pk, :pkPrefix)',
          ExpressionAttributeValues: { ':pkPrefix': PK_PREFIX },
          Limit: limit,
          ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
        }),
      );
      const items = (result.Items ?? []).map((item) =>
        this.mapFromDynamoDB(item as Record<string, unknown>),
      );
      return {
        items,
        ...(result.LastEvaluatedKey && {
          lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown>,
        }),
      };
    } catch (e) {
      throw new DatabaseError('Scan users failed', e);
    }
  }

  async getById(userId: string): Promise<User | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: `${PK_PREFIX}${userId}`, sk: SK_META },
        }),
      );
      if (!result.Item) return null;
      return this.mapFromDynamoDB(result.Item);
    } catch (e) {
      throw new DatabaseError('Get user failed', e);
    }
  }

  async getByEmail(email: string): Promise<User | null> {
    const normalized = normalizeEmail(email);
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: `${EMAIL_PREFIX}${normalized}`, sk: SK_META },
        }),
      );
      if (!result.Item?.userId) return null;
      return this.getById(result.Item.userId as string);
    } catch (e) {
      throw new DatabaseError('Get user by email failed', e);
    }
  }

  async getByProviderId(provider: string, providerId: string): Promise<User | null> {
    return this.getById(`${provider}_${providerId}`);
  }

  async getByPhone(phone: string): Promise<User | null> {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: `${PHONE_PREFIX}${normalized}`, sk: SK_META },
        }),
      );
      if (!result.Item?.userId) return null;
      return this.getById(result.Item.userId as string);
    } catch (e) {
      throw new DatabaseError('Get user by phone failed', e);
    }
  }

  async create(user: User): Promise<User> {
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(user),
          ConditionExpression: 'attribute_not_exists(pk)',
        }),
      );
      if (user.email) {
        const normalized = normalizeEmail(user.email);
        await this.docClient.send(
          new PutCommand({
            TableName: this.tableName,
            Item: {
              pk: `${EMAIL_PREFIX}${normalized}`,
              sk: SK_META,
              userId: user.id,
            },
            ConditionExpression: 'attribute_not_exists(pk)',
          }),
        );
      }
      if (user.phone) {
        const normalized = normalizePhone(user.phone);
        await this.docClient.send(
          new PutCommand({
            TableName: this.tableName,
            Item: {
              pk: `${PHONE_PREFIX}${normalized}`,
              sk: SK_META,
              userId: user.id,
            },
            ConditionExpression: 'attribute_not_exists(pk)',
          }),
        );
      }
      return user;
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'ConditionalCheckFailedException') {
        throw new DatabaseError('User already exists', e);
      }
      throw new DatabaseError('Create user failed', e);
    }
  }

  async update(user: User): Promise<User> {
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(user),
        }),
      );
      return user;
    } catch (e) {
      throw new DatabaseError('Update user failed', e);
    }
  }

  private mapToDynamoDB(user: User): Record<string, unknown> {
    const item: Record<string, unknown> = {
      pk: `${PK_PREFIX}${user.id}`,
      sk: SK_META,
      id: user.id,
      email: user.email,
      phone: user.phone,
      passwordHash: user.passwordHash,
      provider: user.provider,
      providerId: user.providerId,
      name: user.name,
      picture: user.picture,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    if (user.preferences && Object.keys(user.preferences).length > 0) {
      item.preferences = user.preferences;
    }
    return item;
  }

  private mapFromDynamoDB(item: Record<string, unknown>): User {
    const prefs = item.preferences as Record<string, unknown> | undefined;
    return {
      id: item.id as string,
      email: item.email as string | undefined,
      phone: item.phone as string | undefined,
      passwordHash: item.passwordHash as string | undefined,
      provider: (item.provider as User['provider']) || 'local',
      providerId: item.providerId as string | undefined,
      name: item.name as string | undefined,
      picture: item.picture as string | undefined,
      role: item.role as User['role'],
      emailVerified: item.emailVerified === true,
      phoneVerified: item.phoneVerified === true,
      preferences: prefs ? (prefs as User['preferences']) : undefined,
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
    };
  }
}
