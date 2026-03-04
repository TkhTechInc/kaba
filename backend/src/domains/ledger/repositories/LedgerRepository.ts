import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
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
    };

    const item = this.mapToDynamoDB(entry);

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(sk)',
        }),
      );

      // Keep the running balance in sync atomically.
      const delta = entry.type === 'sale' ? entry.amount : -entry.amount;
      await this.updateRunningBalance(entry.businessId, delta, entry.currency);

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
        FilterExpression: 'attribute_not_exists(deletedAt)',
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
      // DynamoDB cannot return a true total count without scanning all pages;
      // Count is items returned after filter, ScannedCount is items scanned before filter —
      // adding them would double-count. Use Count for the current page only.
      const total = result.Count ?? 0;

      return {
        items,
        total,
        page,
        limit,
        lastEvaluatedKey: result.LastEvaluatedKey,
      };
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

    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
          UpdateExpression: 'SET deletedAt = :deletedAt',
          ExpressionAttributeValues: { ':deletedAt': now },
          ConditionExpression: 'attribute_exists(sk) AND attribute_not_exists(deletedAt)',
        }),
      );
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'ConditionalCheckFailedException') {
        // Another concurrent request already deleted this entry and reversed the balance
        return false;
      }
      throw new DatabaseError('Soft-delete ledger entry failed', e);
    }

    // We won the race — only we should reverse the balance
    const delta = entry.type === 'sale' ? -entry.amount : entry.amount;
    await this.updateRunningBalance(businessId, delta, entry.currency);
    return true;
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
  ): Promise<Array<{ type: LedgerEntry['type']; amount: number }>> {
    const entries: Array<{ type: LedgerEntry['type']; amount: number }> = [];
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
          ProjectionExpression: '#t, amount',
          ExpressionAttributeNames: { '#t': 'type' },
          ExclusiveStartKey: lastKey,
        }),
      );

      for (const item of result.Items ?? []) {
        entries.push({
          type: item['type'] as LedgerEntry['type'],
          amount: Number(item['amount'] ?? 0),
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
    };
  }
}
