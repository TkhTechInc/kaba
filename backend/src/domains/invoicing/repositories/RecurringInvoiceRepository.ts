import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  RecurringInvoiceSchedule,
  RecurrenceInterval,
} from '../models/RecurringInvoiceSchedule';
import { DatabaseError } from '@/shared/errors/DomainError';
import { v4 as uuidv4 } from 'uuid';

const SK_PREFIX = 'RECURRING#';

export interface CreateRecurringScheduleInput {
  businessId: string;
  templateInvoiceId: string;
  customerId: string;
  interval: RecurrenceInterval;
  nextRunAt: string;
  createdBy?: string;
}

export class RecurringInvoiceRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async create(input: CreateRecurringScheduleInput): Promise<RecurringInvoiceSchedule> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const schedule: RecurringInvoiceSchedule = {
      id,
      businessId: input.businessId,
      templateInvoiceId: input.templateInvoiceId,
      customerId: input.customerId,
      interval: input.interval,
      nextRunAt: input.nextRunAt,
      createdAt: now,
      createdBy: input.createdBy,
      isActive: true,
    };

    const item = this.mapToDynamoDB(schedule);

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(sk)',
        })
      );
      return schedule;
    } catch (e) {
      const err = e as Error & { name?: string };
      const detail = err?.name
        ? { awsError: err.name, message: err.message }
        : { message: String(e) };
      console.error(
        '[RecurringInvoiceRepository] Create schedule failed:',
        err?.name ?? e,
        err?.message ?? e
      );
      throw new DatabaseError('Create recurring schedule failed', detail);
    }
  }

  async getById(businessId: string, id: string): Promise<RecurringInvoiceSchedule | null> {
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
      throw new DatabaseError('Get recurring schedule failed', e);
    }
  }

  async listByBusiness(businessId: string): Promise<RecurringInvoiceSchedule[]> {
    const items: RecurringInvoiceSchedule[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': businessId,
            ':skPrefix': SK_PREFIX,
          },
          ExclusiveStartKey: lastKey,
        })
      );
      const batch = (result.Items || []).map((item) =>
        this.mapFromDynamoDB(item)
      );
      items.push(...batch);
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  }

  /**
   * List all active schedules where nextRunAt <= cutoff (for cron processing).
   * Uses Scan since we need cross-business query; acceptable for MSME scale.
   */
  async listDueSchedules(cutoffIso: string): Promise<RecurringInvoiceSchedule[]> {
    const items: RecurringInvoiceSchedule[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression:
            'entityType = :et AND #active = :true AND nextRunAt <= :cutoff',
          ExpressionAttributeNames: { '#active': 'isActive' },
          ExpressionAttributeValues: {
            ':et': 'RECURRING_SCHEDULE',
            ':true': true,
            ':cutoff': cutoffIso,
          },
          ExclusiveStartKey: lastKey,
        })
      );
      const batch = (result.Items || []).map((item) =>
        this.mapFromDynamoDB(item)
      );
      items.push(...batch);
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  }

  async updateNextRun(
    businessId: string,
    id: string,
    nextRunAt: string,
    lastRunAt: string
  ): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            pk: businessId,
            sk: `${SK_PREFIX}${id}`,
          },
          UpdateExpression:
            'SET nextRunAt = :nextRunAt, lastRunAt = :lastRunAt',
          ExpressionAttributeValues: {
            ':nextRunAt': nextRunAt,
            ':lastRunAt': lastRunAt,
          },
          ConditionExpression: 'attribute_exists(sk)',
        })
      );
    } catch (e) {
      throw new DatabaseError('Update recurring schedule nextRunAt failed', e);
    }
  }

  async setInactive(businessId: string, id: string): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            pk: businessId,
            sk: `${SK_PREFIX}${id}`,
          },
          UpdateExpression: 'SET isActive = :false',
          ExpressionAttributeValues: { ':false': false },
          ConditionExpression: 'attribute_exists(sk)',
        })
      );
    } catch (e) {
      throw new DatabaseError('Set recurring schedule inactive failed', e);
    }
  }

  private mapToDynamoDB(schedule: RecurringInvoiceSchedule): Record<string, unknown> {
    return {
      pk: schedule.businessId,
      sk: `${SK_PREFIX}${schedule.id}`,
      entityType: 'RECURRING_SCHEDULE',
      id: schedule.id,
      businessId: schedule.businessId,
      templateInvoiceId: schedule.templateInvoiceId,
      customerId: schedule.customerId,
      interval: schedule.interval,
      nextRunAt: schedule.nextRunAt,
      lastRunAt: schedule.lastRunAt,
      createdAt: schedule.createdAt,
      createdBy: schedule.createdBy,
      isActive: schedule.isActive,
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): RecurringInvoiceSchedule {
    return {
      id: String(item.id ?? ''),
      businessId: String(item.businessId ?? item.pk ?? ''),
      templateInvoiceId: String(item.templateInvoiceId ?? ''),
      customerId: String(item.customerId ?? ''),
      interval: (item.interval as RecurrenceInterval) ?? 'monthly',
      nextRunAt: String(item.nextRunAt ?? ''),
      lastRunAt: item.lastRunAt != null ? String(item.lastRunAt) : undefined,
      createdAt: String(item.createdAt ?? ''),
      createdBy: item.createdBy != null ? String(item.createdBy) : undefined,
      isActive: Boolean(item.isActive ?? true),
    };
  }
}
