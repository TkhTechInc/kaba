import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ApiKey, CreateApiKeyInput, ApiKeyScope } from '../models/ApiKey';
import { DatabaseError } from '@/shared/errors/DomainError';
import { v4 as uuidv4 } from 'uuid';

const SK_PREFIX = 'APIKEY#';
const LOOKUP_PK_PREFIX = 'KEYHASH#';

export class ApiKeyRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async create(
    input: CreateApiKeyInput,
    keyHash: string,
    keyPrefix: string
  ): Promise<ApiKey> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const apiKey: ApiKey = {
      id,
      businessId: input.businessId,
      name: input.name,
      keyHash,
      keyPrefix,
      scopes: input.scopes,
      createdAt: now,
    };

    const item = this.mapToDynamoDB(apiKey);
    const lookupItem = this.mapToLookupItem(apiKey);

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(sk)',
        })
      );
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: lookupItem,
          ConditionExpression: 'attribute_not_exists(sk)',
        })
      );
      return apiKey;
    } catch (e) {
      throw new DatabaseError('Create API key failed', e);
    }
  }

  async getByKeyHash(keyHash: string): Promise<ApiKey | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `${LOOKUP_PK_PREFIX}${keyHash}`,
            sk: 'APIKEY',
          },
        })
      );

      if (!result.Item) return null;
      return this.mapFromLookupItem(result.Item);
    } catch (e) {
      throw new DatabaseError('Get API key by hash failed', e);
    }
  }

  async getById(businessId: string, id: string): Promise<ApiKey | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: businessId,
            sk: `${SK_PREFIX}${id}`,
          },
        })
      );

      if (!result.Item) return null;
      return this.mapFromDynamoDB(result.Item);
    } catch (e) {
      throw new DatabaseError('Get API key failed', e);
    }
  }

  async listByBusiness(businessId: string): Promise<ApiKey[]> {
    try {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': businessId,
            ':skPrefix': SK_PREFIX,
          },
        })
      );

      const items = (result.Items || []).map((item) => this.mapFromDynamoDB(item));
      return items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    } catch (e) {
      throw new DatabaseError('List API keys failed', e);
    }
  }

  async delete(businessId: string, id: string): Promise<void> {
    const existing = await this.getById(businessId, id);
    if (!existing) return;

    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            pk: businessId,
            sk: `${SK_PREFIX}${id}`,
          },
        })
      );
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            pk: `${LOOKUP_PK_PREFIX}${existing.keyHash}`,
            sk: 'APIKEY',
          },
        })
      );
    } catch (e) {
      throw new DatabaseError('Delete API key failed', e);
    }
  }

  async updateLastUsed(keyHash: string): Promise<void> {
    const key = await this.getByKeyHash(keyHash);
    if (!key) return;

    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            pk: key.businessId,
            sk: `${SK_PREFIX}${key.id}`,
          },
          UpdateExpression: 'SET lastUsedAt = :now',
          ExpressionAttributeValues: { ':now': new Date().toISOString() },
        })
      );
    } catch {
      // Non-critical, ignore
    }
  }

  private mapToDynamoDB(apiKey: ApiKey): Record<string, unknown> {
    return {
      pk: apiKey.businessId,
      sk: `${SK_PREFIX}${apiKey.id}`,
      entityType: 'APIKEY',
      id: apiKey.id,
      businessId: apiKey.businessId,
      name: apiKey.name,
      keyHash: apiKey.keyHash,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
    };
  }

  private mapToLookupItem(apiKey: ApiKey): Record<string, unknown> {
    return {
      pk: `${LOOKUP_PK_PREFIX}${apiKey.keyHash}`,
      sk: 'APIKEY',
      entityType: 'APIKEY_LOOKUP',
      id: apiKey.id,
      businessId: apiKey.businessId,
      scopes: apiKey.scopes,
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): ApiKey {
    const scopes = (item.scopes as ApiKeyScope[]) ?? [];
    return {
      id: String(item.id ?? ''),
      businessId: String(item.businessId ?? item.pk ?? ''),
      name: String(item.name ?? ''),
      keyHash: String(item.keyHash ?? ''),
      keyPrefix: String(item.keyPrefix ?? ''),
      scopes,
      lastUsedAt: item.lastUsedAt ? String(item.lastUsedAt) : undefined,
      createdAt: String(item.createdAt ?? ''),
    };
  }

  private mapFromLookupItem(item: Record<string, unknown>): ApiKey {
    const scopes = (item.scopes as ApiKeyScope[]) ?? [];
    const pk = String(item.pk ?? '');
    const keyHash = pk.startsWith(LOOKUP_PK_PREFIX) ? pk.slice(LOOKUP_PK_PREFIX.length) : pk;
    return {
      id: String(item.id ?? ''),
      businessId: String(item.businessId ?? ''),
      name: '',
      keyHash,
      keyPrefix: '',
      scopes,
      createdAt: '',
    };
  }
}
