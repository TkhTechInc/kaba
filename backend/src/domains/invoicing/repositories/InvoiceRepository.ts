import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { Invoice, CreateInvoiceInput, InvoiceStatus, UpdateInvoiceInput } from '../models/Invoice';
import { DatabaseError, ValidationError } from '@/shared/errors/DomainError';
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
      earlyPaymentDiscountPercent: input.earlyPaymentDiscountPercent,
      earlyPaymentDiscountDays: input.earlyPaymentDiscountDays,
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
      const err = e as Error & { name?: string };
      const detail = err?.name
        ? { awsError: err.name, message: err.message }
        : { message: String(e) };
      console.error('[InvoiceRepository] Create invoice failed:', err?.name ?? e, err?.message ?? e);
      throw new DatabaseError('Create invoice failed', detail);
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

  async update(
    businessId: string,
    id: string,
    input: UpdateInvoiceInput
  ): Promise<Invoice | null> {
    const existing = await this.getById(businessId, id);
    if (!existing) return null;
    if (existing.status !== 'draft' && existing.status !== 'pending_approval') {
      return null;
    }

    const updated: Invoice = {
      ...existing,
      ...(input.customerId != null && { customerId: input.customerId }),
      ...(input.amount != null && { amount: input.amount }),
      ...(input.currency != null && { currency: input.currency }),
      ...(input.items != null && { items: input.items }),
      ...(input.dueDate != null && { dueDate: input.dueDate }),
      ...(input.earlyPaymentDiscountPercent != null && {
        earlyPaymentDiscountPercent: input.earlyPaymentDiscountPercent,
      }),
      ...(input.earlyPaymentDiscountDays != null && {
        earlyPaymentDiscountDays: input.earlyPaymentDiscountDays,
      }),
    };

    try {
      const item = this.mapToDynamoDB(updated);
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_exists(sk)',
        })
      );
      return updated;
    } catch (e) {
      throw new DatabaseError('Update invoice failed', e);
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

  /**
   * Approve a pending_approval invoice — transitions to 'draft'.
   * Conditional on current status to prevent double-approvals.
   */
  async approve(businessId: string, id: string): Promise<Invoice | null> {
    const existing = await this.getById(businessId, id);
    if (!existing) return null;

    if (existing.status !== 'pending_approval') {
      throw new ValidationError(
        `Invoice ${id} cannot be approved: current status is '${existing.status}'`
      );
    }

    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
          UpdateExpression: 'SET #status = :draft',
          ConditionExpression: '#status = :pending',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':draft': 'draft',
            ':pending': 'pending_approval',
          },
        })
      );
      return { ...existing, status: 'draft' };
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'ConditionalCheckFailedException') {
        throw new ValidationError('Invoice was already approved or status changed concurrently');
      }
      throw new DatabaseError('Approve invoice failed', e);
    }
  }

  /**
   * Update MECeF fields after DGI confirmation.
   */
  async updateMECeF(
    businessId: string,
    id: string,
    mecefStatus: 'pending' | 'confirmed' | 'rejected',
    fields?: { mecefQrCode?: string; mecefSerialNumber?: string; mecefToken?: string }
  ): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
          UpdateExpression:
            'SET mecefStatus = :ms' +
            (fields?.mecefToken !== undefined ? ', mecefToken = :mt' : '') +
            (fields?.mecefQrCode !== undefined ? ', mecefQrCode = :qr' : '') +
            (fields?.mecefSerialNumber !== undefined ? ', mecefSerialNumber = :sn' : ''),
          ExpressionAttributeValues: {
            ':ms': mecefStatus,
            ...(fields?.mecefToken !== undefined && { ':mt': fields.mecefToken }),
            ...(fields?.mecefQrCode !== undefined && { ':qr': fields.mecefQrCode }),
            ...(fields?.mecefSerialNumber !== undefined && { ':sn': fields.mecefSerialNumber }),
          },
        })
      );
    } catch (e) {
      throw new DatabaseError('Update MECeF fields failed', e);
    }
  }

  /** List invoices filtered by status. */
  async listByBusinessAndStatus(
    businessId: string,
    status: InvoiceStatus,
    limit = 20,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<{ items: Invoice[]; lastEvaluatedKey?: Record<string, unknown> }> {
    try {
      const limitNum = Number(limit) || 20;
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          FilterExpression: '#status = :status',
          ExpressionAttributeValues: {
            ':pk': businessId,
            ':skPrefix': SK_PREFIX,
            ':status': status,
          },
          ExpressionAttributeNames: { '#status': 'status' },
          Limit: limitNum,
          ScanIndexForward: false,
          ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
        })
      );
      return {
        items: (result.Items ?? []).map((item) => this.mapFromDynamoDB(item)),
        lastEvaluatedKey: result.LastEvaluatedKey,
      };
    } catch (e) {
      throw new DatabaseError('List invoices by status failed', e);
    }
  }

  async listByBusiness(
    businessId: string,
    page: number = 1,
    limit: number = 20,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<ListByBusinessResult> {
    try {
      const limitNum = Number(limit) || 20;
      const params = {
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': businessId,
          ':skPrefix': SK_PREFIX,
        },
        Limit: limitNum,
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
      ...(invoice.earlyPaymentDiscountPercent != null && {
        earlyPaymentDiscountPercent: invoice.earlyPaymentDiscountPercent,
      }),
      ...(invoice.earlyPaymentDiscountDays != null && {
        earlyPaymentDiscountDays: invoice.earlyPaymentDiscountDays,
      }),
      ...(invoice.mecefToken != null && { mecefToken: invoice.mecefToken }),
      ...(invoice.mecefStatus != null && { mecefStatus: invoice.mecefStatus }),
      ...(invoice.mecefQrCode != null && { mecefQrCode: invoice.mecefQrCode }),
      ...(invoice.mecefSerialNumber != null && { mecefSerialNumber: invoice.mecefSerialNumber }),
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
      earlyPaymentDiscountPercent:
        item.earlyPaymentDiscountPercent != null
          ? Number(item.earlyPaymentDiscountPercent)
          : undefined,
      earlyPaymentDiscountDays:
        item.earlyPaymentDiscountDays != null
          ? Number(item.earlyPaymentDiscountDays)
          : undefined,
      mecefToken: item.mecefToken != null ? String(item.mecefToken) : undefined,
      mecefStatus: item.mecefStatus != null
        ? (item.mecefStatus as 'pending' | 'confirmed' | 'rejected')
        : undefined,
      mecefQrCode: item.mecefQrCode != null ? String(item.mecefQrCode) : undefined,
      mecefSerialNumber: item.mecefSerialNumber != null ? String(item.mecefSerialNumber) : undefined,
    };
  }
}
