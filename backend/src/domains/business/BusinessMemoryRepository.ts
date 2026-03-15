import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DatabaseError } from '@/shared/errors/DomainError';

export interface AgentMemory {
  defaultCurrency?: string;
  frequentProducts?: string[];
  topCustomers?: string[];
  updatedAt?: string;
}

const SK_AGENT_MEMORY = 'AGENT_MEMORY';

export class BusinessMemoryRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async get(businessId: string): Promise<AgentMemory | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: SK_AGENT_MEMORY },
        }),
      );
      if (!result.Item) return null;
      return {
        defaultCurrency: result.Item.defaultCurrency as string | undefined,
        frequentProducts: (result.Item.frequentProducts as string[]) ?? undefined,
        topCustomers: (result.Item.topCustomers as string[]) ?? undefined,
        updatedAt: result.Item.updatedAt as string | undefined,
      };
    } catch (e) {
      throw new DatabaseError('Get agent memory failed', e);
    }
  }

  async update(businessId: string, input: Partial<AgentMemory>): Promise<AgentMemory> {
    const now = new Date().toISOString();
    const existing = await this.get(businessId);
    const merged: AgentMemory = {
      defaultCurrency: input.defaultCurrency ?? existing?.defaultCurrency,
      frequentProducts: input.frequentProducts ?? existing?.frequentProducts,
      topCustomers: input.topCustomers ?? existing?.topCustomers,
      updatedAt: now,
    };
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: businessId,
            sk: SK_AGENT_MEMORY,
            entityType: 'AGENT_MEMORY',
            defaultCurrency: merged.defaultCurrency ?? undefined,
            frequentProducts: merged.frequentProducts ?? undefined,
            topCustomers: merged.topCustomers ?? undefined,
            updatedAt: merged.updatedAt,
          },
        }),
      );
      return merged;
    } catch (e) {
      throw new DatabaseError('Update agent memory failed', e);
    }
  }
}
