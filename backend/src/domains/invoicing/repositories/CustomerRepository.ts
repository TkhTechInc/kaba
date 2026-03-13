import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { Customer, CreateCustomerInput, UpdateCustomerInput } from '../models/Customer';
import { DatabaseError } from '@/shared/errors/DomainError';
import { v4 as uuidv4 } from 'uuid';

const SK_PREFIX = 'CUSTOMER#';

export interface ListByBusinessResult {
  items: Customer[];
  total: number;
  page: number;
  limit: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

export class CustomerRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async create(input: CreateCustomerInput): Promise<Customer> {
    const id = uuidv4();
    const customer: Customer = {
      id,
      businessId: input.businessId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      createdAt: new Date().toISOString(),
    };

    const item = this.mapToDynamoDB(customer);

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(sk)',
        })
      );
      return customer;
    } catch (e) {
      throw new DatabaseError('Create customer failed', e);
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
          ExpressionAttributeValues: { ':pk': businessId, ':skPrefix': SK_PREFIX },
          ...(lastKey && { ExclusiveStartKey: lastKey }),
        })
      );
      count += result.Count ?? 0;
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
    return count;
  }

  async getById(businessId: string, id: string): Promise<Customer | null> {
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
      throw new DatabaseError('Get customer failed', e);
    }
  }

  async update(businessId: string, id: string, input: UpdateCustomerInput): Promise<Customer | null> {
    const updates: string[] = [];
    const exprNames: Record<string, string> = {};
    const exprValues: Record<string, unknown> = {};

    if (input.name !== undefined) {
      updates.push('#n = :name');
      exprNames['#n'] = 'name';
      exprValues[':name'] = input.name;
    }
    if (input.email !== undefined) {
      updates.push('#e = :email');
      exprNames['#e'] = 'email';
      exprValues[':email'] = input.email;
    }
    if (input.phone !== undefined) {
      updates.push('#p = :phone');
      exprNames['#p'] = 'phone';
      exprValues[':phone'] = input.phone;
    }

    if (updates.length === 0) {
      return this.getById(businessId, id);
    }

    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
          UpdateExpression: `SET ${updates.join(', ')}`,
          ExpressionAttributeNames: exprNames,
          ExpressionAttributeValues: exprValues,
          ConditionExpression: 'attribute_exists(sk)',
        })
      );
      return this.getById(businessId, id);
    } catch (e) {
      throw new DatabaseError('Update customer failed', e);
    }
  }

  async delete(businessId: string, id: string): Promise<boolean> {
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
          ConditionExpression: 'attribute_exists(sk)',
        })
      );
      return true;
    } catch (e) {
      throw new DatabaseError('Delete customer failed', e);
    }
  }

  /** List all customers for a business (for compliance export). */
  async listAllByBusiness(businessId: string): Promise<Customer[]> {
    const items: Customer[] = [];
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

  /**
   * Find a customer by email within a business.
   * Uses a query with FilterExpression on the business partition key.
   */
  async findByEmail(businessId: string, email: string): Promise<Customer | null> {
    try {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          FilterExpression: '#e = :email',
          ExpressionAttributeValues: {
            ':pk': businessId,
            ':skPrefix': SK_PREFIX,
            ':email': email,
          },
          ExpressionAttributeNames: { '#e': 'email' },
          Limit: 1,
        })
      );
      if (!result.Items?.length) return null;
      return this.mapFromDynamoDB(result.Items[0]);
    } catch (e) {
      throw new DatabaseError('Find customer by email failed', e);
    }
  }

  /** Anonymize customer PII (right to be forgotten). */
  async anonymize(businessId: string, id: string): Promise<boolean> {
    const placeholder = '[erased]';
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
          UpdateExpression: 'SET #n = :name, #e = :email, #p = :phone',
          ExpressionAttributeNames: {
            '#n': 'name',
            '#e': 'email',
            '#p': 'phone',
          },
          ExpressionAttributeValues: {
            ':name': placeholder,
            ':email': placeholder,
            ':phone': placeholder,
          },
          ConditionExpression: 'attribute_exists(sk)',
        })
      );
      return true;
    } catch (e) {
      throw new DatabaseError('Anonymize customer failed', e);
    }
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

      const filterParts: string[] = [];
      const exprNames: Record<string, string> = {};
      const exprValues: Record<string, unknown> = { ':pk': businessId, ':skPrefix': SK_PREFIX };

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

      const baseParams = {
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: exprValues,
        ScanIndexForward: false,
        ...(filterParts.length > 0 && { FilterExpression: filterParts.join(' AND ') }),
        ...(Object.keys(exprNames).length > 0 && { ExpressionAttributeNames: exprNames }),
      };

      // When date filtering, fetch all and paginate in-app sorted by createdAt desc
      if (fromDate || toDate) {
        const allItems: Customer[] = [];
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
        return { items: allItems.slice(start, start + limitNum), total, page: pageNum, limit: limitNum };
      }

      let cursor: Record<string, unknown> | undefined = exclusiveStartKey;
      for (let i = 0; i < pageNum - 1; i++) {
        const skipResult = await this.docClient.send(
          new QueryCommand({ ...baseParams, Limit: limitNum, ...(cursor && { ExclusiveStartKey: cursor }) })
        );
        cursor = skipResult.LastEvaluatedKey;
        if (!cursor) {
          return { items: [], total: (pageNum - 1) * limitNum, page: pageNum, limit: limitNum };
        }
      }

      const result = await this.docClient.send(
        new QueryCommand({ ...baseParams, Limit: limitNum, ...(cursor && { ExclusiveStartKey: cursor }) })
      );
      const items = (result.Items || []).map((item) => this.mapFromDynamoDB(item));
      const hasMore = !!result.LastEvaluatedKey;
      const total = (pageNum - 1) * limitNum + items.length + (hasMore ? limitNum : 0);

      return {
        items,
        total,
        page: pageNum,
        limit: limitNum,
        lastEvaluatedKey: result.LastEvaluatedKey,
      };
    } catch (e) {
      throw new DatabaseError('List customers failed', e);
    }
  }

  async listWithCursor(
    businessId: string,
    limit: number = 20,
    cursor?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<{ items: Customer[]; nextCursor: string | null; hasMore: boolean }> {
    const exclusiveStartKey = cursor
      ? (JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as Record<string, unknown>)
      : undefined;

    const filterParts: string[] = [];
    const exprNames: Record<string, string> = {};
    const exprValues: Record<string, unknown> = { ':pk': businessId, ':skPrefix': SK_PREFIX };

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
        ExpressionAttributeValues: exprValues,
        ScanIndexForward: false,
        ...(filterParts.length > 0 && { FilterExpression: filterParts.join(' AND ') }),
        ...(Object.keys(exprNames).length > 0 && { ExpressionAttributeNames: exprNames }),
        Limit: limit,
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
  ): Promise<Customer[]> {
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

  private mapToDynamoDB(customer: Customer): Record<string, unknown> {
    return {
      pk: customer.businessId,
      sk: `${SK_PREFIX}${customer.id}`,
      entityType: 'CUSTOMER',
      id: customer.id,
      businessId: customer.businessId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      ...(customer.createdAt != null && { createdAt: customer.createdAt }),
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): Customer {
    return {
      id: String(item.id ?? ''),
      businessId: String(item.businessId ?? item.pk ?? ''),
      name: String(item.name ?? ''),
      email: String(item.email ?? ''),
      phone: item.phone != null ? String(item.phone) : undefined,
      createdAt: item.createdAt != null ? String(item.createdAt) : undefined,
    };
  }
}
