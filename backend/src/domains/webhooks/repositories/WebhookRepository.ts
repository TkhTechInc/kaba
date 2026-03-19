import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Webhook, CreateWebhookInput } from '../models/Webhook';
import { DatabaseError } from '@/shared/errors/DomainError';
import { v4 as uuidv4 } from 'uuid';

const SK_PREFIX = 'WEBHOOK#';

export class WebhookRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async create(input: CreateWebhookInput): Promise<Webhook> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const webhook: Webhook = {
      id,
      businessId: input.businessId,
      url: input.url,
      secret: input.secret,
      events: input.events,
      enabled: true,
      createdAt: now,
    };

    const item = this.mapToDynamoDB(webhook);

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(sk)',
        })
      );
      return webhook;
    } catch (e) {
      throw new DatabaseError('Create webhook failed', e);
    }
  }

  async getById(businessId: string, id: string): Promise<Webhook | null> {
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
      throw new DatabaseError('Get webhook failed', e);
    }
  }

  async listByBusiness(businessId: string): Promise<Webhook[]> {
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
      throw new DatabaseError('List webhooks failed', e);
    }
  }

  async delete(businessId: string, id: string): Promise<void> {
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
    } catch (e) {
      throw new DatabaseError('Delete webhook failed', e);
    }
  }

  private mapToDynamoDB(webhook: Webhook): Record<string, unknown> {
    return {
      pk: webhook.businessId,
      sk: `${SK_PREFIX}${webhook.id}`,
      entityType: 'WEBHOOK',
      id: webhook.id,
      businessId: webhook.businessId,
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events,
      enabled: webhook.enabled,
      createdAt: webhook.createdAt,
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): Webhook {
    const events = (item.events as Webhook['events']) ?? [];
    return {
      id: String(item.id ?? ''),
      businessId: String(item.businessId ?? item.pk ?? ''),
      url: String(item.url ?? ''),
      secret: String(item.secret ?? ''),
      events,
      enabled: Boolean(item.enabled ?? true),
      createdAt: String(item.createdAt ?? ''),
    };
  }
}
