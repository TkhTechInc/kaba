import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { LedgerEntry, CreateLedgerEntryInput } from '../models/LedgerEntry';
import { DatabaseError } from '@/shared/errors/DomainError';
import { v4 as uuidv4 } from 'uuid';

const ENTITY_TYPE = 'LEDGER';
const SK_PREFIX = 'LEDGER#';

export interface ListByBusinessResult {
  items: LedgerEntry[];
  total: number;
  page: number;
  limit: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

export class LedgerRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async create(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const entry: LedgerEntry = {
      id,
      businessId: input.businessId,
      type: input.type,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      category: input.category,
      date: input.date,
      createdAt: now,
      productId: input.productId,
      quantitySold: input.quantitySold,
      originalCurrency: input.originalCurrency,
      exchangeRate: input.exchangeRate,
      forexGainLoss: input.forexGainLoss,
      supplierId: input.supplierId,
    };

    const item = this.mapToDynamoDB(entry);
    const delta = entry.type === 'sale' ? entry.amount : -entry.amount;

    try {
      // ATOMIC TRANSACTION: Both operations succeed or both fail
      // This prevents race conditions and financial data corruption
      await this.docClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: item,
                ConditionExpression: 'attribute_not_exists(sk)',
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: { pk: entry.businessId, sk: LedgerRepository.BALANCE_SK },
                UpdateExpression: 'ADD balance :delta SET currency = :currency',
                ExpressionAttributeValues: {
                  ':delta': delta,
                  ':currency': entry.currency,
                },
              },
            },
          ],
        }),
      );

      return entry;
    } catch (e) {
      throw new DatabaseError('Create ledger entry failed', e);
    }
  }

  async getById(businessId: string, id: string): Promise<LedgerEntry | null> {
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
      throw new DatabaseError('Get ledger entry failed', e);
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
    type?: 'sale' | 'expense',
    fromDate?: string,
    toDate?: string,
  ): Promise<ListByBusinessResult> {
    try {
      const limitNum = Number(limit) || 20;
      const pageNum = Math.max(1, Number(page) || 1);

      const filterParts = ['attribute_not_exists(deletedAt)'];
      const expressionAttributeValues: Record<string, unknown> = {
        ':pk': businessId,
        ':skPrefix': SK_PREFIX,
      };
      const expressionAttributeNames: Record<string, string> = {};

      if (type) {
        filterParts.push('#entryType = :entryType');
        expressionAttributeNames['#entryType'] = 'type';
        expressionAttributeValues[':entryType'] = type;
      }
      if (fromDate) {
        filterParts.push('#dt >= :fromDate');
        expressionAttributeNames['#dt'] = 'date';
        expressionAttributeValues[':fromDate'] = fromDate;
      }
      if (toDate) {
        filterParts.push('#dt <= :toDate');
        expressionAttributeNames['#dt'] = 'date';
        expressionAttributeValues[':toDate'] = toDate;
      }

      const baseParams = {
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        FilterExpression: filterParts.join(' AND '),
        ExpressionAttributeValues: expressionAttributeValues,
        ...(Object.keys(expressionAttributeNames).length > 0 && { ExpressionAttributeNames: expressionAttributeNames }),
      };

      // Always fetch all matching items, sort by date desc (newest first), then paginate.
      // DynamoDB sort key is LEDGER#<uuid> (random), so we must sort in-app by date.
      const allItems: LedgerEntry[] = [];
      let lastKey: Record<string, unknown> | undefined = exclusiveStartKey;
      do {
        const result = await this.docClient.send(
          new QueryCommand({ ...baseParams, ...(lastKey && { ExclusiveStartKey: lastKey }) })
        );
        allItems.push(...(result.Items ?? []).map((item) => this.mapFromDynamoDB(item)));
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);

      allItems.sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
      });
      const total = allItems.length;
      const start = (pageNum - 1) * limitNum;
      return { items: allItems.slice(start, start + limitNum), total, page: pageNum, limit: limitNum };
    } catch (e) {
      throw new DatabaseError('List ledger entries failed', e);
    }
  }

  async listByBusinessAndDateRange(
    businessId: string,
    fromDate: string,
    toDate: string,
  ): Promise<LedgerEntry[]> {
    const entries: LedgerEntry[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          FilterExpression: '#dt >= :from AND #dt <= :to',
          ExpressionAttributeNames: { '#dt': 'date' },
          ExpressionAttributeValues: {
            ':pk': businessId,
            ':skPrefix': SK_PREFIX,
            ':from': fromDate,
            ':to': toDate,
          },
          ExclusiveStartKey: lastKey,
        }),
      );
      const items = (result.Items || []).map((item) => this.mapFromDynamoDB(item));
      entries.push(...items);
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }

  async countByBusinessInDateRange(
    businessId: string,
    fromDate: string,
    toDate: string,
  ): Promise<number> {
    let count = 0;
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          FilterExpression: '#dt >= :from AND #dt <= :to AND attribute_not_exists(deletedAt)',
          ExpressionAttributeNames: { '#dt': 'date' },
          ExpressionAttributeValues: {
            ':pk': businessId,
            ':skPrefix': SK_PREFIX,
            ':from': fromDate,
            ':to': toDate,
          },
          Select: 'COUNT',
          ExclusiveStartKey: lastKey,
        }),
      );
      count += result.Count ?? 0;
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return count;
  }

  /**
   * Admin: list recent ledger entries across all businesses (Scan with limit).
   */
  async scanRecentEntriesAcrossBusinesses(
    limit: number = 50,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<{ items: LedgerEntry[]; lastEvaluatedKey?: Record<string, unknown> }> {
    try {
      const result = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'entityType = :entityType',
          ExpressionAttributeValues: { ':entityType': ENTITY_TYPE },
          Limit: limit,
          ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
        })
      );
      const items = (result.Items || []).map((item) => this.mapFromDynamoDB(item));
      items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      return {
        items,
        lastEvaluatedKey: result.LastEvaluatedKey,
      };
    } catch (e) {
      throw new DatabaseError('Scan recent ledger entries failed', e);
    }
  }

  /** Soft-delete ledger entry (compliance erasure). */
  async softDelete(businessId: string, id: string): Promise<boolean> {
    const now = new Date().toISOString();
    // Fetch entry first to get amount/currency for balance reversal
    const entry = await this.getById(businessId, id);
    if (!entry || entry.deletedAt) return false;

    const delta = entry.type === 'sale' ? -entry.amount : entry.amount;

    try {
      // ATOMIC TRANSACTION: Soft delete + balance reversal
      await this.docClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.tableName,
                Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
                UpdateExpression: 'SET deletedAt = :deletedAt',
                ExpressionAttributeValues: { ':deletedAt': now },
                ConditionExpression: 'attribute_exists(sk) AND attribute_not_exists(deletedAt)',
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: { pk: businessId, sk: LedgerRepository.BALANCE_SK },
                UpdateExpression: 'ADD balance :delta',
                ExpressionAttributeValues: { ':delta': delta },
              },
            },
          ],
        }),
      );
      return true;
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'ConditionalCheckFailedException' ||
          (e as { name?: string })?.name === 'TransactionCanceledException') {
        // Another concurrent request already deleted this entry
        return false;
      }
      throw new DatabaseError('Soft-delete ledger entry failed', e);
    }
  }

  /**
   * Computes balance by paginating through all entries but fetches only `amount` and `type` fields
   * via ProjectionExpression, reducing DynamoDB data transfer significantly.
   *
   * PREFERRED APPROACH: Use getRunningBalance() instead, which is O(1) via a single GetItem on
   * a dedicated BALANCE item that is maintained atomically on every create/delete. This paginating
   * query is retained as a fallback (e.g. for rebuilding the counter from scratch).
   */
  async listAllByBusinessForBalance(
    businessId: string,
  ): Promise<Array<{ type: LedgerEntry['type']; amount: number; date: string; category: string; currency: string }>> {
    const entries: Array<{ type: LedgerEntry['type']; amount: number; date: string; category: string; currency: string }> = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          FilterExpression: 'attribute_not_exists(deletedAt)',
          ExpressionAttributeValues: {
            ':pk': businessId,
            ':skPrefix': SK_PREFIX,
          },
          ProjectionExpression: '#t, amount, #dt, #cat, currency',
          ExpressionAttributeNames: { '#t': 'type', '#dt': 'date', '#cat': 'category' },
          ExclusiveStartKey: lastKey,
        }),
      );

      for (const item of result.Items ?? []) {
        entries.push({
          type: item['type'] as LedgerEntry['type'],
          amount: Number(item['amount'] ?? 0),
          date: String(item['date'] ?? ''),
          category: String(item['category'] ?? 'Other'),
          currency: String(item['currency'] ?? 'NGN'),
        });
      }
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return entries;
  }

  // ---------------------------------------------------------------------------
  // Running-balance counter (O(1) reads)
  // ---------------------------------------------------------------------------
  // We maintain a dedicated item: pk=businessId, sk=BALANCE.
  // The `balance` attribute is kept in sync via atomic ADD on every write.
  // getRunningBalance() is a single GetItem — no table scan.

  private static readonly BALANCE_SK = 'BALANCE';

  /**
   * Atomically adjust the running balance by `delta` (positive for sales, negative for expenses).
   * Uses DynamoDB ADD so concurrent writes are safe without application-level locking.
   */
  async updateRunningBalance(
    businessId: string,
    delta: number,
    currency: string,
  ): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: LedgerRepository.BALANCE_SK },
          UpdateExpression: 'ADD balance :delta SET currency = :currency',
          ExpressionAttributeValues: { ':delta': delta, ':currency': currency },
        }),
      );
    } catch (e) {
      throw new DatabaseError('Update running balance failed', e);
    }
  }

  /**
   * O(1) balance read — single GetItem on the BALANCE item.
   * Returns null if the counter has never been initialised (no entries yet).
   */
  async getRunningBalance(
    businessId: string,
  ): Promise<{ balance: number; currency: string } | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: LedgerRepository.BALANCE_SK },
        }),
      );
      if (!result.Item) return null;
      return {
        balance: Number(result.Item['balance'] ?? 0),
        currency: String(result.Item['currency'] ?? 'NGN'),
      };
    } catch (e) {
      throw new DatabaseError('Get running balance failed', e);
    }
  }

  /** List all ledger entries for a business (for compliance export, includes soft-deleted). */
  async listAllByBusiness(businessId: string): Promise<LedgerEntry[]> {
    const entries: LedgerEntry[] = [];
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

      const items = (result.Items || []).map((item) => this.mapFromDynamoDB(item));
      entries.push(...items);
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return entries;
  }

  async listWithCursor(
    businessId: string,
    limit: number = 20,
    cursor?: string,
    type?: 'sale' | 'expense',
    fromDate?: string,
    toDate?: string,
  ): Promise<{ items: LedgerEntry[]; nextCursor: string | null; hasMore: boolean }> {
    const exclusiveStartKey = cursor
      ? (JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as Record<string, unknown>)
      : undefined;

    const filterParts = ['attribute_not_exists(deletedAt)'];
    const expressionAttributeValues: Record<string, unknown> = {
      ':pk': businessId,
      ':skPrefix': SK_PREFIX,
    };
    const expressionAttributeNames: Record<string, string> = {};

    if (type) {
      filterParts.push('#entryType = :entryType');
      expressionAttributeNames['#entryType'] = 'type';
      expressionAttributeValues[':entryType'] = type;
    }
    if (fromDate) {
      filterParts.push('#dt >= :fromDate');
      expressionAttributeNames['#dt'] = 'date';
      expressionAttributeValues[':fromDate'] = fromDate;
    }
    if (toDate) {
      filterParts.push('#dt <= :toDate');
      expressionAttributeNames['#dt'] = 'date';
      expressionAttributeValues[':toDate'] = toDate;
    }

    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        FilterExpression: filterParts.join(' AND '),
        ExpressionAttributeValues: expressionAttributeValues,
        ...(Object.keys(expressionAttributeNames).length > 0 && { ExpressionAttributeNames: expressionAttributeNames }),
        Limit: limit,
        ScanIndexForward: false,
        ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
      })
    );

    const nextCursor = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url')
      : null;

    return {
      items: (result.Items ?? []).map((item) => this.mapFromDynamoDB(item)),
      nextCursor,
      hasMore: !!result.LastEvaluatedKey,
    };
  }

  async listSince(
    businessId: string,
    since: string,
    limit: number = 500,
  ): Promise<LedgerEntry[]> {
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

  private mapToDynamoDB(entry: LedgerEntry): Record<string, unknown> {
    return {
      pk: entry.businessId,
      sk: `${SK_PREFIX}${entry.id}`,
      entityType: ENTITY_TYPE,
      id: entry.id,
      businessId: entry.businessId,
      type: entry.type,
      amount: entry.amount,
      currency: entry.currency,
      description: entry.description,
      category: entry.category,
      date: entry.date,
      createdAt: entry.createdAt,
      ...(entry.productId != null && { productId: entry.productId }),
      ...(entry.quantitySold != null && { quantitySold: entry.quantitySold }),
      ...(entry.originalCurrency != null && { originalCurrency: entry.originalCurrency }),
      ...(entry.exchangeRate != null && { exchangeRate: entry.exchangeRate }),
      ...(entry.forexGainLoss != null && { forexGainLoss: entry.forexGainLoss }),
      ...(entry.supplierId != null && { supplierId: entry.supplierId }),
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): LedgerEntry {
    return {
      id: String(item.id ?? ''),
      businessId: String(item.businessId ?? item.pk ?? ''),
      type: (item.type as LedgerEntry['type']) ?? 'sale',
      amount: Number(item.amount ?? 0),
      currency: String(item.currency ?? ''),
      description: String(item.description ?? ''),
      category: String(item.category ?? ''),
      date: String(item.date ?? ''),
      createdAt: String(item.createdAt ?? ''),
      deletedAt: item.deletedAt != null ? String(item.deletedAt) : undefined,
      productId: item.productId != null ? String(item.productId) : undefined,
      quantitySold: item.quantitySold != null ? Number(item.quantitySold) : undefined,
      originalCurrency: item.originalCurrency != null ? String(item.originalCurrency) : undefined,
      exchangeRate: item.exchangeRate != null ? Number(item.exchangeRate) : undefined,
      forexGainLoss: item.forexGainLoss != null ? Number(item.forexGainLoss) : undefined,
      supplierId: item.supplierId != null ? String(item.supplierId) : undefined,
    };
  }
}
