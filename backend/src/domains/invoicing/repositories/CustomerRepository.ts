import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
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
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<ListByBusinessResult> {
    try {
      const limitNum = Number(limit) || 20;
      const pageNum = Math.max(1, Number(page) || 1);

      let cursor: Record<string, unknown> | undefined = exclusiveStartKey;
      for (let i = 0; i < pageNum - 1; i++) {
        const skipResult = await this.docClient.send(
          new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
            ExpressionAttributeValues: { ':pk': businessId, ':skPrefix': SK_PREFIX },
            Limit: limitNum,
            ScanIndexForward: false,
            ...(cursor && { ExclusiveStartKey: cursor }),
          })
        );
        cursor = skipResult.LastEvaluatedKey;
        if (!cursor) {
          return { items: [], total: (pageNum - 1) * limitNum, page: pageNum, limit: limitNum };
        }
      }

      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          ExpressionAttributeValues: { ':pk': businessId, ':skPrefix': SK_PREFIX },
          Limit: limitNum,
          ScanIndexForward: false,
          ...(cursor && { ExclusiveStartKey: cursor }),
        })
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
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): Customer {
    return {
      id: String(item.id ?? ''),
      businessId: String(item.businessId ?? item.pk ?? ''),
      name: String(item.name ?? ''),
      email: String(item.email ?? ''),
      phone: item.phone != null ? String(item.phone) : undefined,
    };
  }
}
