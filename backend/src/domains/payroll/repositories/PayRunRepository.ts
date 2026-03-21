import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { PayRun, CreatePayRunInput } from '../models/PayRun';
import { DatabaseError } from '@/shared/errors/DomainError';
import { v4 as uuidv4 } from 'uuid';

const SK_PREFIX = 'PAYRUN#';

export interface ListPayRunsResult {
  items: PayRun[];
  total: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

export class PayRunRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async create(input: CreatePayRunInput): Promise<PayRun> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const payRun: PayRun = {
      id,
      businessId: input.businessId,
      periodMonth: input.periodMonth,
      status: 'draft',
      totalGross: 0,
      totalNet: 0,
      totalEmployerContributions: 0,
      totalEmployeeDeductions: 0,
      totalIncomeTax: 0,
      currency: 'XOF',
      createdAt: now,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(payRun),
          ConditionExpression: 'attribute_not_exists(sk)',
        }),
      );
      return payRun;
    } catch (e) {
      throw new DatabaseError('Create pay run failed', e);
    }
  }

  async findById(businessId: string, id: string): Promise<PayRun | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
        }),
      );
      if (!result.Item) return null;
      return this.mapFromDynamoDB(result.Item as Record<string, unknown>);
    } catch (e) {
      throw new DatabaseError('Get pay run failed', e);
    }
  }

  async update(payRun: PayRun): Promise<PayRun> {
    try {
      const item = this.mapToDynamoDB(payRun);
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
        }),
      );
      return payRun;
    } catch (e) {
      throw new DatabaseError('Update pay run failed', e);
    }
  }

  async listByBusiness(
    businessId: string,
    from?: string,
    to?: string,
    limit = 50,
  ): Promise<ListPayRunsResult> {
    try {
      const items: PayRun[] = [];
      let lastKey: Record<string, unknown> | undefined;

      const skPrefix = SK_PREFIX;
      let keyCond = 'pk = :pk AND begins_with(sk, :skPrefix)';
      const exprValues: Record<string, unknown> = { ':pk': businessId, ':skPrefix': skPrefix };

      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: keyCond,
          ExpressionAttributeValues: exprValues,
          ScanIndexForward: false,
          Limit: limit,
          ...(lastKey && { ExclusiveStartKey: lastKey }),
        }),
      );

      let rawItems = result.Items ?? [];
      if (from || to) {
        rawItems = rawItems.filter((i) => {
          const pr = i as { periodMonth?: string };
          const pm = pr.periodMonth ?? '';
          if (from && pm < from) return false;
          if (to && pm > to) return false;
          return true;
        });
      }
      items.push(...rawItems.map((i) => this.mapFromDynamoDB(i as Record<string, unknown>)));
      lastKey = result.LastEvaluatedKey;

      return {
        items,
        total: items.length,
        lastEvaluatedKey: lastKey,
      };
    } catch (e) {
      throw new DatabaseError('List pay runs failed', e);
    }
  }

  async findByPeriod(businessId: string, periodMonth: string): Promise<PayRun | null> {
    const { items } = await this.listByBusiness(businessId, periodMonth, periodMonth, 1);
    return items[0] ?? null;
  }

  buildDynamoItem(payRun: PayRun): Record<string, unknown> {
    return this.mapToDynamoDB(payRun);
  }

  async createWithLines(
    payRun: PayRun,
    lineItems: Record<string, unknown>[],
  ): Promise<void> {
    const payRunItem = this.mapToDynamoDB(payRun);
    const transactItems = [
      {
        Put: {
          TableName: this.tableName,
          Item: payRunItem,
          ConditionExpression: 'attribute_not_exists(sk)',
        },
      },
      ...lineItems.map((item) => ({
        Put: {
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(sk)',
        },
      })),
    ];
    try {
      await this.docClient.send(
        new TransactWriteCommand({ TransactItems: transactItems }),
      );
    } catch (e) {
      throw new DatabaseError('Create pay run with lines failed', e);
    }
  }

  private mapToDynamoDB(payRun: PayRun): Record<string, unknown> {
    const item: Record<string, unknown> = {
      pk: payRun.businessId,
      sk: `${SK_PREFIX}${payRun.id}`,
      entityType: 'PAYRUN',
      id: payRun.id,
      businessId: payRun.businessId,
      periodMonth: payRun.periodMonth,
      status: payRun.status,
      totalGross: payRun.totalGross,
      totalNet: payRun.totalNet,
      totalEmployerContributions: payRun.totalEmployerContributions,
      totalEmployeeDeductions: payRun.totalEmployeeDeductions,
      totalIncomeTax: payRun.totalIncomeTax,
      currency: payRun.currency,
      createdAt: payRun.createdAt,
    };
    if (payRun.finalizedAt != null) item.finalizedAt = payRun.finalizedAt;
    if (payRun.paidAt != null) item.paidAt = payRun.paidAt;
    if (payRun.ledgerEntryIds != null) item.ledgerEntryIds = payRun.ledgerEntryIds;
    return item;
  }

  private mapFromDynamoDB(item: Record<string, unknown>): PayRun {
    return {
      id: String(item.id ?? ''),
      businessId: String(item.businessId ?? item.pk ?? ''),
      periodMonth: String(item.periodMonth ?? ''),
      status: (item.status as PayRun['status']) ?? 'draft',
      totalGross: Number(item.totalGross ?? 0),
      totalNet: Number(item.totalNet ?? 0),
      totalEmployerContributions: Number(item.totalEmployerContributions ?? 0),
      totalEmployeeDeductions: Number(item.totalEmployeeDeductions ?? 0),
      totalIncomeTax: Number(item.totalIncomeTax ?? 0),
      currency: String(item.currency ?? 'XOF'),
      finalizedAt: item.finalizedAt != null ? String(item.finalizedAt) : undefined,
      paidAt: item.paidAt != null ? String(item.paidAt) : undefined,
      ledgerEntryIds: Array.isArray(item.ledgerEntryIds) ? (item.ledgerEntryIds as string[]) : undefined,
      createdAt: String(item.createdAt ?? ''),
    };
  }
}
