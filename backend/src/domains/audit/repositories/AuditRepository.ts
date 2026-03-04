import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { AuditLog, LogAuditInput } from '../models/AuditLog';
import { DatabaseError } from '@/shared/errors/DomainError';
import { v4 as uuidv4 } from 'uuid';

const SK_PREFIX = 'AUDIT#';
const DEFAULT_TTL_DAYS = 2555; // 7 years

export class AuditRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly retentionDays: number = DEFAULT_TTL_DAYS
  ) {}

  async append(input: LogAuditInput): Promise<AuditLog> {
    const timestamp = new Date().toISOString();
    const id = uuidv4();
    const sk = `${SK_PREFIX}${timestamp}#${id}`;

    const pk = input.businessId || 'GLOBAL';

    const ttlSeconds =
      Math.floor(Date.now() / 1000) + this.retentionDays * 24 * 60 * 60;

    const auditLog: AuditLog = {
      id,
      entityType: input.entityType,
      entityId: input.entityId,
      businessId: input.businessId,
      action: input.action,
      userId: input.userId,
      timestamp,
      changes: input.changes,
      metadata: input.metadata,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    };

    const item: Record<string, unknown> = {
      pk,
      sk,
      entityType: input.entityType,
      entityId: input.entityId,
      id: auditLog.id,
      businessId: input.businessId,
      action: auditLog.action,
      userId: auditLog.userId,
      timestamp: auditLog.timestamp,
      ttl: ttlSeconds,
      ...(auditLog.changes && { changes: auditLog.changes }),
      ...(auditLog.metadata && Object.keys(auditLog.metadata).length > 0 && { metadata: auditLog.metadata }),
      ...(auditLog.ipAddress && { ipAddress: auditLog.ipAddress }),
      ...(auditLog.userAgent && { userAgent: auditLog.userAgent }),
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
        })
      );
      return auditLog;
    } catch (e) {
      throw new DatabaseError('Append audit log failed', e);
    }
  }

  /** List all audit logs for a business (for compliance export). */
  async listAllByBusiness(businessId: string): Promise<AuditLog[]> {
    const items: AuditLog[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await this.queryByBusiness(
        businessId,
        undefined,
        undefined,
        100,
        lastKey
      );
      items.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    return items;
  }

  async queryByBusiness(
    businessId: string,
    from?: string,
    to?: string,
    limit: number = 50,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<{ items: AuditLog[]; lastEvaluatedKey?: Record<string, unknown> }> {
    const pk = businessId || 'GLOBAL';
    const skPrefix = SK_PREFIX;

    const keyCondition = from && to
      ? 'pk = :pk AND sk BETWEEN :skFrom AND :skTo'
      : 'pk = :pk AND begins_with(sk, :skPrefix)';

    const exprValues: Record<string, unknown> = {
      ':pk': pk,
    };
    if (from && to) {
      exprValues[':skFrom'] = `${skPrefix}${from}`;
      exprValues[':skTo'] = `${skPrefix}${to}\uffff`;
    } else {
      exprValues[':skPrefix'] = skPrefix;
    }

    try {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: keyCondition,
          ExpressionAttributeValues: exprValues,
          Limit: Math.min(limit, 100),
          ScanIndexForward: false,
          ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
        })
      );

      const items = (result.Items || []).map((item) => this.mapFromDynamoDB(item));
      return {
        items,
        lastEvaluatedKey: result.LastEvaluatedKey,
      };
    } catch (e) {
      throw new DatabaseError('Query audit logs failed', e);
    }
  }

  private mapFromDynamoDB(item: Record<string, unknown>): AuditLog {
    return {
      id: String(item.id ?? ''),
      entityType: String(item.entityType ?? ''),
      entityId: String(item.entityId ?? ''),
      businessId: String(item.businessId ?? item.pk ?? ''),
      action: item.action as AuditLog['action'],
      userId: String(item.userId ?? ''),
      timestamp: String(item.timestamp ?? ''),
      changes: item.changes as AuditLog['changes'],
      metadata: item.metadata as AuditLog['metadata'],
      ipAddress: item.ipAddress != null ? String(item.ipAddress) : undefined,
      userAgent: item.userAgent != null ? String(item.userAgent) : undefined,
    };
  }
}
