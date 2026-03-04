import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Invoice, CreateInvoiceInput, InvoiceStatus } from '../models/Invoice';
import { DatabaseError } from '@/shared/errors/DomainError';
import { v4 as uuidv4 } from 'uuid';

const SK_PREFIX = 'INVOICE#';

export interface ListByBusinessResult {
  items: Invoice[];
  total: number;
  page: number;
  limit: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

export class InvoiceRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async create(input: CreateInvoiceInput): Promise<Invoice> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const invoice: Invoice = {
      id,
      businessId: input.businessId,
      customerId: input.customerId,
      amount: input.amount,
      currency: input.currency,
      status: input.status ?? 'draft',
      items: input.items,
      dueDate: input.dueDate,
      createdAt: now,
    };

    const item = this.mapToDynamoDB(invoice);

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(sk)',
        })
      );
      return invoice;
    } catch (e) {
      throw new DatabaseError('Create invoice failed', e);
    }
  }

  async getById(businessId: string, id: string): Promise<Invoice | null> {
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
      throw new DatabaseError('Get invoice failed', e);
    }
  }

  async updateStatus(
    businessId: string,
    id: string,
    status: InvoiceStatus
  ): Promise<Invoice | null> {
    const existing = await this.getById(businessId, id);
    if (!existing) return null;

    const updated: Invoice = { ...existing, status };
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            pk: businessId,
            sk: `${SK_PREFIX}${id}`,
          },
          UpdateExpression: 'SET #status = :status',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':status': status },
        })
      );
      return updated;
    } catch (e) {
      throw new DatabaseError('Update invoice status failed', e);
    }
  }

  /** List all invoices for a business (for compliance export, includes soft-deleted). */
  async listAllByBusiness(businessId: string): Promise<Invoice[]> {
    const items: Invoice[] = [];
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
      const batch = (result.Items || []).map((item) => this.mapFromDynamoDB(item));
      items.push(...batch);
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  }

  /** Soft-delete invoice (compliance erasure). */
  async softDelete(businessId: string, id: string): Promise<boolean> {
    const now = new Date().toISOString();
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
          UpdateExpression: 'SET deletedAt = :deletedAt',
          ExpressionAttributeValues: { ':deletedAt': now },
          ConditionExpression: 'attribute_exists(sk)',
        })
      );
      return true;
    } catch (e) {
      throw new DatabaseError('Soft-delete invoice failed', e);
    }
  }

  async listByBusiness(
    businessId: string,
    page: number = 1,
    limit: number = 20,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<ListByBusinessResult> {
    try {
      const params = {
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': businessId,
          ':skPrefix': SK_PREFIX,
        },
        Limit: limit,
        ScanIndexForward: false,
        ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
      };

      const result = await this.docClient.send(new QueryCommand(params));
      const items = (result.Items || []).map((item) => this.mapFromDynamoDB(item));
      const total = (result.Count ?? 0) + (result.ScannedCount ?? 0);

      return {
        items,
        total,
        page,
        limit,
        lastEvaluatedKey: result.LastEvaluatedKey,
      };
    } catch (e) {
      throw new DatabaseError('List invoices failed', e);
    }
  }

  private mapToDynamoDB(invoice: Invoice): Record<string, unknown> {
    return {
      pk: invoice.businessId,
      sk: `${SK_PREFIX}${invoice.id}`,
      entityType: 'INVOICE',
      id: invoice.id,
      businessId: invoice.businessId,
      customerId: invoice.customerId,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      items: invoice.items,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): Invoice {
    const items = (item.items as Invoice['items']) ?? [];
    return {
      id: String(item.id ?? ''),
      businessId: String(item.businessId ?? item.pk ?? ''),
      customerId: String(item.customerId ?? ''),
      amount: Number(item.amount ?? 0),
      currency: String(item.currency ?? ''),
      status: (item.status as Invoice['status']) ?? 'draft',
      items,
      dueDate: String(item.dueDate ?? ''),
      createdAt: String(item.createdAt ?? ''),
      deletedAt: item.deletedAt != null ? String(item.deletedAt) : undefined,
    };
  }
}
