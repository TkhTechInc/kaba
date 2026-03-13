import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Supplier } from '../models/Supplier';
import { DatabaseError } from '@/shared/errors/DomainError';
import { v4 as uuidv4 } from 'uuid';

const SK_PREFIX = 'SUPPLIER#';

export class SupplierRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async create(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const supplier: Supplier = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(supplier),
          ConditionExpression: 'attribute_not_exists(sk)',
        }),
      );
      return supplier;
    } catch (e) {
      throw new DatabaseError('Create supplier failed', e);
    }
  }

  async findById(businessId: string, id: string): Promise<Supplier | null> {
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
      throw new DatabaseError('Get supplier failed', e);
    }
  }

  async listByBusiness(businessId: string, limit = 100): Promise<Supplier[]> {
    try {
      const items: Supplier[] = [];
      let lastKey: Record<string, unknown> | undefined;

      do {
        const result = await this.docClient.send(
          new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
            ExpressionAttributeValues: { ':pk': businessId, ':skPrefix': SK_PREFIX },
            ScanIndexForward: false,
            Limit: limit,
            ...(lastKey && { ExclusiveStartKey: lastKey }),
          }),
        );
        items.push(...(result.Items ?? []).map((i) => this.mapFromDynamoDB(i as Record<string, unknown>)));
        lastKey = result.LastEvaluatedKey;
      } while (lastKey && items.length < limit);

      return items;
    } catch (e) {
      throw new DatabaseError('List suppliers failed', e);
    }
  }

  async update(supplier: Supplier): Promise<Supplier> {
    const updated = { ...supplier, updatedAt: new Date().toISOString() };
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(updated),
        }),
      );
      return updated;
    } catch (e) {
      throw new DatabaseError('Update supplier failed', e);
    }
  }

  async delete(businessId: string, id: string): Promise<void> {
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
        }),
      );
    } catch (e) {
      throw new DatabaseError('Delete supplier failed', e);
    }
  }

  private mapToDynamoDB(supplier: Supplier): Record<string, unknown> {
    const item: Record<string, unknown> = {
      pk: supplier.businessId,
      sk: `${SK_PREFIX}${supplier.id}`,
      entityType: 'SUPPLIER',
      id: supplier.id,
      businessId: supplier.businessId,
      name: supplier.name,
      currency: supplier.currency,
      countryCode: supplier.countryCode,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    };
    if (supplier.phone != null) item.phone = supplier.phone;
    if (supplier.momoPhone != null) item.momoPhone = supplier.momoPhone;
    if (supplier.bankAccount != null) item.bankAccount = supplier.bankAccount;
    if (supplier.notes != null) item.notes = supplier.notes;
    return item;
  }

  private mapFromDynamoDB(item: Record<string, unknown>): Supplier {
    return {
      id: String(item.id ?? ''),
      businessId: String(item.businessId ?? item.pk ?? ''),
      name: String(item.name ?? ''),
      currency: String(item.currency ?? 'NGN'),
      countryCode: String(item.countryCode ?? ''),
      phone: item.phone != null ? String(item.phone) : undefined,
      momoPhone: item.momoPhone != null ? String(item.momoPhone) : undefined,
      bankAccount: item.bankAccount != null ? String(item.bankAccount) : undefined,
      notes: item.notes != null ? String(item.notes) : undefined,
      createdAt: String(item.createdAt ?? ''),
      updatedAt: String(item.updatedAt ?? ''),
    };
  }
}
