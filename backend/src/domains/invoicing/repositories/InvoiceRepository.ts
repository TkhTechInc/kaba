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
    return this.updateStatusWithPaymentIntent(businessId, id, status);
  }

  /**
   * Update invoice status and optionally set paymentIntentId (when marking paid).
   */
  async updateStatusWithPaymentIntent(
    businessId: string,
    id: string,
    status: InvoiceStatus,
    paymentIntentId?: string
  ): Promise<Invoice | null> {
    const existing = await this.getById(businessId, id);
    if (!existing) return null;

    const updated: Invoice = {
      ...existing,
      status,
      ...(paymentIntentId != null && { paymentIntentId }),
    };
    try {
      const updateExpr = paymentIntentId != null
        ? 'SET #status = :status, paymentIntentId = :pid'
        : 'SET #status = :status';
      const exprValues: Record<string, unknown> = { ':status': status };
      if (paymentIntentId != null) exprValues[':pid'] = paymentIntentId;

      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            pk: businessId,
            sk: `${SK_PREFIX}${id}`,
          },
          UpdateExpression: updateExpr,
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: exprValues,
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

    return items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
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

  /**
   * List invoices with dueDate in the given range (for reports).
   */
  async listByBusinessAndDateRange(
    businessId: string,
    fromDate: string,
    toDate: string,
  ): Promise<Invoice[]> {
    const allItems: Invoice[] = [];
    let lastKey: Record<string, unknown> | undefined;

    const filterParts = [
      'attribute_not_exists(deletedAt)',
      '#dd >= :fromDate',
      '#dd <= :toDate',
    ];
    const exprValues: Record<string, unknown> = {
      ':pk': businessId,
      ':skPrefix': SK_PREFIX,
      ':fromDate': fromDate,
      ':toDate': toDate,
    };

    do {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          FilterExpression: filterParts.join(' AND '),
          ExpressionAttributeNames: { '#dd': 'dueDate' },
          ExpressionAttributeValues: exprValues,
          ...(lastKey && { ExclusiveStartKey: lastKey }),
        }),
      );
      allItems.push(...(result.Items ?? []).map((item) => this.mapFromDynamoDB(item)));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return allItems.sort((a, b) => (b.createdAt ?? b.dueDate ?? '').localeCompare(a.createdAt ?? a.dueDate ?? ''));
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
      const items = (result.Items ?? []).map((item) => this.mapFromDynamoDB(item));
      items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      return {
        items,
        lastEvaluatedKey: result.LastEvaluatedKey,
      };
    } catch (e) {
      throw new DatabaseError('List invoices by status failed', e);
    }
  }

  async countByBusiness(businessId: string): Promise<number> {
    let count = 0;
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          Select: 'COUNT',
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          FilterExpression: 'attribute_not_exists(deletedAt)',
          ExpressionAttributeValues: { ':pk': businessId, ':skPrefix': SK_PREFIX },
          ...(lastKey && { ExclusiveStartKey: lastKey }),
        })
      );
      count += result.Count ?? 0;
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
    return count;
  }

  async listByBusiness(
    businessId: string,
    page: number = 1,
    limit: number = 20,
    exclusiveStartKey?: Record<string, unknown>,
    fromDate?: string,
    toDate?: string,
  ): Promise<ListByBusinessResult> {
    try {
      const limitNum = Number(limit) || 20;
      const pageNum = Math.max(1, Number(page) || 1);

      const filterParts = ['attribute_not_exists(deletedAt)'];
      const exprValues: Record<string, unknown> = { ':pk': businessId, ':skPrefix': SK_PREFIX };
      const exprNames: Record<string, string> = {};

      if (fromDate) {
        filterParts.push('#ca >= :fromDate');
        exprNames['#ca'] = 'createdAt';
        exprValues[':fromDate'] = fromDate;
      }
      if (toDate) {
        // toDate is inclusive: compare against end of that day
        filterParts.push('#ca <= :toDate');
        exprNames['#ca'] = 'createdAt';
        exprValues[':toDate'] = toDate + 'T23:59:59.999Z';
      }

      const baseParams = {
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        FilterExpression: filterParts.join(' AND '),
        ExpressionAttributeValues: exprValues,
        ...(Object.keys(exprNames).length > 0 && { ExpressionAttributeNames: exprNames }),
        ScanIndexForward: false,
      };

      // When date filtering, fetch all matching items and do in-app pagination
      // (DynamoDB FilterExpression doesn't reduce capacity units; pagination is still needed)
      if (fromDate || toDate) {
        const allItems: Invoice[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
          const result = await this.docClient.send(
            new QueryCommand({ ...baseParams, ...(lastKey && { ExclusiveStartKey: lastKey }) })
          );
          allItems.push(...(result.Items ?? []).map((item) => this.mapFromDynamoDB(item)));
          lastKey = result.LastEvaluatedKey;
        } while (lastKey);

        // Sort newest first by createdAt
        allItems.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const total = allItems.length;
        const start = (pageNum - 1) * limitNum;
        return {
          items: allItems.slice(start, start + limitNum),
          total,
          page: pageNum,
          limit: limitNum,
        };
      }

      // Fetch all, sort by createdAt desc (newest first), then paginate
      const allItems: Invoice[] = [];
      let lastKey: Record<string, unknown> | undefined;
      do {
        const result = await this.docClient.send(
          new QueryCommand({ ...baseParams, ...(lastKey && { ExclusiveStartKey: lastKey }) })
        );
        allItems.push(...(result.Items ?? []).map((item) => this.mapFromDynamoDB(item)));
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
      throw new DatabaseError('List invoices failed', e);
    }
  }

  /**
   * List invoices for a specific customer within a business, excluding cancelled ones.
   */
  async listByCustomerId(
    businessId: string,
    customerId: string,
    limit = 50,
  ): Promise<Invoice[]> {
    const items: Invoice[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          FilterExpression: 'customerId = :cid AND #s <> :cancelled AND attribute_not_exists(deletedAt)',
          ExpressionAttributeValues: {
            ':pk': businessId,
            ':skPrefix': SK_PREFIX,
            ':cid': customerId,
            ':cancelled': 'cancelled',
          },
          ExpressionAttributeNames: { '#s': 'status' },
          ScanIndexForward: false,
          Limit: limit,
          ...(lastKey && { ExclusiveStartKey: lastKey }),
        })
      );
      items.push(...(result.Items ?? []).map((item) => this.mapFromDynamoDB(item)));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey && items.length < limit);

    return items
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .slice(0, limit);
  }

  async listWithCursor(
    businessId: string,
    limit: number = 20,
    cursor?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<{ items: Invoice[]; nextCursor: string | null; hasMore: boolean }> {
    const exclusiveStartKey = cursor
      ? (JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as Record<string, unknown>)
      : undefined;

    const filterParts = ['attribute_not_exists(deletedAt)'];
    const exprValues: Record<string, unknown> = { ':pk': businessId, ':skPrefix': SK_PREFIX };
    const exprNames: Record<string, string> = {};

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

    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        FilterExpression: filterParts.join(' AND '),
        ExpressionAttributeValues: exprValues,
        ...(Object.keys(exprNames).length > 0 && { ExpressionAttributeNames: exprNames }),
        Limit: limit,
        ScanIndexForward: false,
        ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
      })
    );

    const nextCursor = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url')
      : null;

    const items = (result.Items ?? []).map((item) => this.mapFromDynamoDB(item));
    items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    return {
      items,
      nextCursor,
      hasMore: !!result.LastEvaluatedKey,
    };
  }

  async listSince(
    businessId: string,
    since: string,
    limit: number = 500,
  ): Promise<Invoice[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        FilterExpression: 'createdAt >= :since',
        ExpressionAttributeValues: {
          ':pk': businessId,
          ':skPrefix': SK_PREFIX,
          ':since': since,
        },
        Limit: limit,
      })
    );
    return (result.Items ?? []).map((item) => this.mapFromDynamoDB(item));
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
      ...(invoice.paymentIntentId != null && { paymentIntentId: invoice.paymentIntentId }),
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
      paymentIntentId: item.paymentIntentId != null ? String(item.paymentIntentId) : undefined,
    };
  }
}
