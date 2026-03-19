import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Product, CreateProductInput, UpdateProductInput } from '../models/Product';
import { DatabaseError, ValidationError } from '@/shared/errors/DomainError';
import { v4 as uuidv4 } from 'uuid';

const SK_PREFIX = 'PRODUCT#';

export interface ListByBusinessResult {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

export class ProductRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async create(input: CreateProductInput): Promise<Product> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const product: Product = {
      id,
      businessId: input.businessId,
      name: input.name,
      brand: input.brand,
      unitPrice: input.unitPrice,
      currency: input.currency,
      quantityInStock: input.quantityInStock,
      lowStockThreshold: input.lowStockThreshold,
      createdAt: now,
      updatedAt: now,
    };

    const item = this.mapToDynamoDB(product);

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(sk)',
        })
      );
      return product;
    } catch (e) {
      throw new DatabaseError('Create product failed', e);
    }
  }

  async getById(businessId: string, id: string): Promise<Product | null> {
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
      throw new DatabaseError('Get product failed', e);
    }
  }

  async listByBusiness(
    businessId: string,
    page: number = 1,
    limit: number = 50,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<ListByBusinessResult> {
    const limitClamped = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const pageNum = Math.max(1, Number(page) || 1);

    try {
      const allItems: Product[] = [];
      let lastKey: Record<string, unknown> | undefined;
      do {
        const result = await this.docClient.send(
          new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
            ExpressionAttributeValues: { ':pk': businessId, ':skPrefix': SK_PREFIX },
            ...(lastKey && { ExclusiveStartKey: lastKey }),
          })
        );
        allItems.push(...(result.Items ?? []).map((item) => this.mapFromDynamoDB(item)));
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);

      allItems.sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''));
      const total = allItems.length;
      const start = (pageNum - 1) * limitClamped;

      return {
        items: allItems.slice(start, start + limitClamped),
        total,
        page: pageNum,
        limit: limitClamped,
      };
    } catch (e) {
      throw new DatabaseError('List products failed', e);
    }
  }

  async update(
    businessId: string,
    id: string,
    input: UpdateProductInput
  ): Promise<Product | null> {
    const existing = await this.getById(businessId, id);
    if (!existing) return null;

    const updates: string[] = [];
    const exprNames: Record<string, string> = {};
    const exprValues: Record<string, unknown> = {};

    if (input.name !== undefined) {
      updates.push('#n = :name');
      exprNames['#n'] = 'name';
      exprValues[':name'] = input.name;
    }
    if (input.brand !== undefined) {
      updates.push('#b = :brand');
      exprNames['#b'] = 'brand';
      exprValues[':brand'] = input.brand;
    }
    if (input.unitPrice !== undefined) {
      updates.push('#up = :unitPrice');
      exprNames['#up'] = 'unitPrice';
      exprValues[':unitPrice'] = input.unitPrice;
    }
    if (input.currency !== undefined) {
      updates.push('#c = :currency');
      exprNames['#c'] = 'currency';
      exprValues[':currency'] = input.currency;
    }
    if (input.quantityInStock !== undefined) {
      updates.push('#q = :quantityInStock');
      exprNames['#q'] = 'quantityInStock';
      exprValues[':quantityInStock'] = input.quantityInStock;
    }
    if (input.lowStockThreshold !== undefined) {
      updates.push('#lst = :lowStockThreshold');
      exprNames['#lst'] = 'lowStockThreshold';
      exprValues[':lowStockThreshold'] = input.lowStockThreshold;
    }

    if (updates.length === 0) return existing;

    const now = new Date().toISOString();
    updates.push('#ua = :updatedAt');
    exprNames['#ua'] = 'updatedAt';
    exprValues[':updatedAt'] = now;

    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            pk: businessId,
            sk: `${SK_PREFIX}${id}`,
          },
          UpdateExpression: `SET ${updates.join(', ')}`,
          ExpressionAttributeNames: exprNames,
          ExpressionAttributeValues: exprValues,
        })
      );

      return { ...existing, ...input, updatedAt: now };
    } catch (e) {
      throw new DatabaseError('Update product failed', e);
    }
  }

  async delete(businessId: string, id: string): Promise<boolean> {
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            pk: businessId,
            sk: `${SK_PREFIX}${id}`,
          },
          ConditionExpression: 'attribute_exists(sk)',
        })
      );
      return true;
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'ConditionalCheckFailedException') {
        return false;
      }
      throw new DatabaseError('Delete product failed', e);
    }
  }

  /**
   * Atomically decrement stock. Allows negative stock — inventory is informational,
   * not a gate; users may forget to update stock before recording a sale.
   */
  async decrementStock(
    businessId: string,
    id: string,
    quantity: number
  ): Promise<Product | null> {
    if (quantity <= 0) {
      throw new ValidationError('quantity must be positive');
    }

    try {
      const result = await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            pk: businessId,
            sk: `${SK_PREFIX}${id}`,
          },
          UpdateExpression: 'SET #q = #q - :qty, #ua = :updatedAt',
          ExpressionAttributeNames: {
            '#q': 'quantityInStock',
            '#ua': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':qty': quantity,
            ':updatedAt': new Date().toISOString(),
          },
          ReturnValues: 'ALL_NEW',
        })
      );

      if (!result.Attributes) return null;
      return this.mapFromDynamoDB(result.Attributes);
    } catch (e: unknown) {
      throw new DatabaseError('Decrement stock failed', e);
    }
  }

  async listWithCursor(
    businessId: string,
    limit: number = 20,
    cursor?: string,
  ): Promise<{ items: Product[]; nextCursor: string | null; hasMore: boolean }> {
    const exclusiveStartKey = cursor
      ? (JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as Record<string, unknown>)
      : undefined;

    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': businessId,
          ':skPrefix': SK_PREFIX,
        },
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
  ): Promise<Product[]> {
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

  private mapToDynamoDB(product: Product): Record<string, unknown> {
    return {
      pk: product.businessId,
      sk: `${SK_PREFIX}${product.id}`,
      id: product.id,
      businessId: product.businessId,
      name: product.name,
      unitPrice: product.unitPrice,
      currency: product.currency,
      quantityInStock: product.quantityInStock,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      ...(product.brand != null && { brand: product.brand }),
      ...(product.lowStockThreshold != null && { lowStockThreshold: product.lowStockThreshold }),
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): Product {
    return {
      id: item.id as string,
      businessId: item.businessId as string,
      name: item.name as string,
      brand: item.brand as string | undefined,
      unitPrice: Number(item.unitPrice),
      currency: item.currency as string,
      quantityInStock: Number(item.quantityInStock),
      lowStockThreshold: item.lowStockThreshold != null ? Number(item.lowStockThreshold) : undefined,
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
    };
  }
}
