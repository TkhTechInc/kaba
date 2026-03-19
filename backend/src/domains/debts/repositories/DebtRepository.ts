import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { Debt, CreateDebtInput } from '../models/Debt';
import { DatabaseError } from '@/shared/errors/DomainError';
import { v4 as uuidv4 } from 'uuid';

const SK_PREFIX = 'DEBT#';

export interface ListDebtsResult {
  items: Debt[];
  total: number;
  page: number;
  limit: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

export class DebtRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async create(input: CreateDebtInput): Promise<Debt> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const status = this.getStatus(input.dueDate);
    const debt: Debt = {
      id,
      businessId: input.businessId,
      debtorName: input.debtorName,
      amount: input.amount,
      currency: input.currency,
      dueDate: input.dueDate,
      status,
      customerId: input.customerId,
      phone: input.phone,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    const item = this.mapToDynamoDB(debt);
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(sk)',
        }),
      );
      return debt;
    } catch (e) {
      throw new DatabaseError('Create debt failed', e);
    }
  }

  async getById(businessId: string, id: string): Promise<Debt | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
        }),
      );
      if (!result.Item) return null;
      return this.mapFromDynamoDB(result.Item);
    } catch (e) {
      throw new DatabaseError('Get debt failed', e);
    }
  }

  async listByBusiness(
    businessId: string,
    page: number = 1,
    limit: number = 20,
    status?: Debt['status'],
    exclusiveStartKey?: Record<string, unknown>,
    fromDate?: string,
    toDate?: string,
  ): Promise<ListDebtsResult> {
    try {
      const limitNum = Number(limit) || 20;
      const pageNum = Math.max(1, Number(page) || 1);

      const filterParts: string[] = [];
      const exprNames: Record<string, string> = {};
      const exprValues: Record<string, unknown> = { ':pk': businessId, ':skPrefix': SK_PREFIX };

      if (status) {
        filterParts.push('#st = :status');
        exprNames['#st'] = 'status';
        exprValues[':status'] = status;
      }
      if (fromDate) {
        filterParts.push('#ca >= :fromDate');
        exprNames['#ca'] = 'createdAt';
        exprValues[':fromDate'] = fromDate;
      }
      if (toDate) {
        filterParts.push('#ca <= :toDate');
        exprNames['#ca'] = 'createdAt';
        exprValues[':toDate'] = toDate + 'T23:59:59.999Z';
      }

      const baseParams: Record<string, unknown> = {
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: exprValues,
        ScanIndexForward: false,
      };
      if (filterParts.length > 0) {
        baseParams.FilterExpression = filterParts.join(' AND ');
        baseParams.ExpressionAttributeNames = exprNames;
      }

      // When date filtering, fetch all and paginate in-app sorted by createdAt desc
      if (fromDate || toDate) {
        const allItems: Debt[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
          const result = await this.docClient.send(
            new QueryCommand({
              ...baseParams,
              ...(lastKey && { ExclusiveStartKey: lastKey }),
            } as import('@aws-sdk/lib-dynamodb').QueryCommandInput)
          );
          allItems.push(...(result.Items ?? []).map((i) => this.mapFromDynamoDB(i as Record<string, unknown>)));
          lastKey = result.LastEvaluatedKey;
        } while (lastKey);

        allItems.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const total = allItems.length;
        const start = (pageNum - 1) * limitNum;
        return { items: allItems.slice(start, start + limitNum), total, page: pageNum, limit: limitNum };
      }

      // Fetch all, sort by createdAt desc (newest first), then paginate
      const allItems: Debt[] = [];
      let lastKey: Record<string, unknown> | undefined;
      do {
        const result = await this.docClient.send(
          new QueryCommand({
            ...baseParams,
            ...(lastKey && { ExclusiveStartKey: lastKey }),
          } as import('@aws-sdk/lib-dynamodb').QueryCommandInput)
        );
        allItems.push(...(result.Items ?? []).map((i) => this.mapFromDynamoDB(i as Record<string, unknown>)));
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);

      allItems.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      const total = allItems.length;
      const start = (pageNum - 1) * limitNum;

      return {
        items: allItems.slice(start, start + limitNum),
        total,
        page: pageNum,
        limit: limitNum,
      };
    } catch (e) {
      throw new DatabaseError('List debts failed', e);
    }
  }

  /**
   * List all unpaid debts (pending or overdue) for aging report.
   * Fetches all matching items by paginating through results.
   */
  async listByBusinessForAging(businessId: string): Promise<Debt[]> {
    const all: Debt[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    try {
      do {
        const params: Record<string, unknown> = {
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          FilterExpression: '#st IN (:pending, :overdue)',
          ExpressionAttributeNames: { '#st': 'status' },
          ExpressionAttributeValues: {
            ':pk': businessId,
            ':skPrefix': SK_PREFIX,
            ':pending': 'pending',
            ':overdue': 'overdue',
          },
          Limit: 500,
          ScanIndexForward: false,
          ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
        };

        const result = await this.docClient.send(
          new QueryCommand(params as import('@aws-sdk/lib-dynamodb').QueryCommandInput),
        );
        const items = (result.Items ?? []).map((i) =>
          this.mapFromDynamoDB(i as Record<string, unknown>),
        );
        all.push(...items);
        exclusiveStartKey = result.LastEvaluatedKey;
      } while (exclusiveStartKey);

      return all.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    } catch (e) {
      throw new DatabaseError('List debts for aging failed', e);
    }
  }

  async updateStatus(businessId: string, id: string, status: Debt['status']): Promise<Debt | null> {
    const existing = await this.getById(businessId, id);
    if (!existing) return null;

    const now = new Date().toISOString();
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
          UpdateExpression: 'SET #st = :status, updatedAt = :now',
          ExpressionAttributeNames: { '#st': 'status' },
          ExpressionAttributeValues: { ':status': status, ':now': now },
        }),
      );
      return { ...existing, status, updatedAt: now };
    } catch (e) {
      throw new DatabaseError('Update debt status failed', e);
    }
  }

  /**
   * Scan all debts across all businesses that are overdue/pending and need a reminder.
   * cutoffDate: YYYY-MM-DD — only debts with dueDate <= cutoffDate are returned.
   * reminderThreshold: ISO string — debts are returned if lastReminderSentAt is absent or <= threshold.
   */
  async scanOverdue(cutoffDate: string, reminderThreshold: string): Promise<Debt[]> {
    const all: Debt[] = [];
    let lastKey: Record<string, unknown> | undefined;
    try {
      do {
        const result = await this.docClient.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression:
              'entityType = :entity' +
              ' AND #st IN (:pending, :overdue)' +
              ' AND dueDate <= :cutoff' +
              ' AND attribute_exists(phone)' +
              ' AND (attribute_not_exists(lastReminderSentAt) OR lastReminderSentAt <= :threshold)',
            ExpressionAttributeNames: {
              '#st': 'status',
            },
            ExpressionAttributeValues: {
              ':entity': 'DEBT',
              ':pending': 'pending',
              ':overdue': 'overdue',
              ':cutoff': cutoffDate,
              ':threshold': reminderThreshold,
            },
            ...(lastKey && { ExclusiveStartKey: lastKey }),
          } as import('@aws-sdk/lib-dynamodb').ScanCommandInput),
        );
        all.push(...(result.Items ?? []).map((i) => this.mapFromDynamoDB(i as Record<string, unknown>)));
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);
      return all;
    } catch (e) {
      throw new DatabaseError('Scan overdue debts failed', e);
    }
  }

  /** Full replace of a debt record (no ConditionExpression). */
  async update(debt: Debt): Promise<Debt> {
    const item = this.mapToDynamoDB(debt);
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
        }),
      );
      return debt;
    } catch (e) {
      throw new DatabaseError('Update debt failed', e);
    }
  }

  private getStatus(dueDate: string): Debt['status'] {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due < today ? 'overdue' : 'pending';
  }

  private mapToDynamoDB(debt: Debt): Record<string, unknown> {
    const item: Record<string, unknown> = {
      pk: debt.businessId,
      sk: `${SK_PREFIX}${debt.id}`,
      entityType: 'DEBT',
      id: debt.id,
      businessId: debt.businessId,
      debtorName: debt.debtorName,
      amount: debt.amount,
      currency: debt.currency,
      dueDate: debt.dueDate,
      status: debt.status,
      customerId: debt.customerId,
      phone: debt.phone,
      notes: debt.notes,
      createdAt: debt.createdAt,
      updatedAt: debt.updatedAt,
    };
    if (debt.lastReminderSentAt != null) {
      item.lastReminderSentAt = debt.lastReminderSentAt;
    }
    return item;
  }

  private mapFromDynamoDB(item: Record<string, unknown>): Debt {
    return {
      id: String(item.id ?? ''),
      businessId: String(item.businessId ?? item.pk ?? ''),
      debtorName: String(item.debtorName ?? ''),
      amount: Number(item.amount ?? 0),
      currency: String(item.currency ?? 'NGN'),
      dueDate: String(item.dueDate ?? ''),
      status: (item.status as Debt['status']) ?? 'pending',
      customerId: item.customerId != null ? String(item.customerId) : undefined,
      phone: item.phone != null ? String(item.phone) : undefined,
      notes: item.notes != null ? String(item.notes) : undefined,
      createdAt: String(item.createdAt ?? ''),
      updatedAt: String(item.updatedAt ?? ''),
      lastReminderSentAt: item.lastReminderSentAt != null ? String(item.lastReminderSentAt) : undefined,
    };
  }
}
