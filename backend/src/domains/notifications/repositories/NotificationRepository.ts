import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { Notification, CreateNotificationInput } from '../models/Notification';
import { DatabaseError } from '@/shared/errors/DomainError';

const ENTITY_TYPE = 'NOTIFICATION';
const SK_PREFIX = 'NOTIF#';

export class NotificationRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const notification: Notification = {
      id,
      businessId: input.businessId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      refId: input.refId,
      read: false,
      createdAt: now,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: input.businessId,
            sk: `${SK_PREFIX}${now}#${id}`,
            entityType: ENTITY_TYPE,
            ...notification,
          },
        }),
      );
      return notification;
    } catch (e) {
      throw new DatabaseError('Create notification failed', e);
    }
  }

  async listByBusiness(
    businessId: string,
    limit = 30,
  ): Promise<Notification[]> {
    try {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': businessId,
            ':skPrefix': SK_PREFIX,
          },
          ScanIndexForward: false,
          Limit: limit,
        }),
      );
      return (result.Items ?? []).map((item) => this.mapFromDynamoDB(item));
    } catch (e) {
      throw new DatabaseError('List notifications failed', e);
    }
  }

  async countUnread(businessId: string): Promise<number> {
    try {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          FilterExpression: '#r = :false',
          ExpressionAttributeNames: { '#r': 'read' },
          ExpressionAttributeValues: {
            ':pk': businessId,
            ':skPrefix': SK_PREFIX,
            ':false': false,
          },
          Select: 'COUNT',
        }),
      );
      return result.Count ?? 0;
    } catch (e) {
      throw new DatabaseError('Count unread notifications failed', e);
    }
  }

  async markRead(businessId: string, id: string, createdAt: string): Promise<void> {
    // sk is NOTIF#<createdAt>#<id>
    const sk = `${SK_PREFIX}${createdAt}#${id}`;
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk },
          UpdateExpression: 'SET #r = :true',
          ExpressionAttributeNames: { '#r': 'read' },
          ExpressionAttributeValues: { ':true': true },
          ConditionExpression: 'attribute_exists(sk)',
        }),
      );
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'ConditionalCheckFailedException') return;
      throw new DatabaseError('Mark notification read failed', e);
    }
  }

  async markAllRead(businessId: string): Promise<void> {
    // List all unread then mark them
    const all = await this.listByBusiness(businessId, 100);
    const unread = all.filter((n) => !n.read);
    await Promise.all(unread.map((n) => this.markRead(businessId, n.id, n.createdAt)));
  }

  private mapFromDynamoDB(item: Record<string, unknown>): Notification {
    return {
      id: String(item['id'] ?? ''),
      businessId: String(item['businessId'] ?? item['pk'] ?? ''),
      type: item['type'] as Notification['type'],
      title: String(item['title'] ?? ''),
      body: String(item['body'] ?? ''),
      link: item['link'] != null ? String(item['link']) : undefined,
      refId: item['refId'] != null ? String(item['refId']) : undefined,
      read: Boolean(item['read']),
      createdAt: String(item['createdAt'] ?? ''),
    };
  }
}
