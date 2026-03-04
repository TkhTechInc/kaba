import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DatabaseError } from '@/shared/errors/DomainError';

const SK_PREFIX = 'USAGE#';

export class UsageRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  private monthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  async getAiQueryCount(businessId: string, month?: string): Promise<number> {
    const m = month ?? this.monthKey();
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${m}` },
        }),
      );
      return Number(result.Item?.aiQueryCount ?? 0);
    } catch (e) {
      throw new DatabaseError('Get usage failed', e);
    }
  }

  async incrementAiQueries(businessId: string): Promise<number> {
    const m = this.monthKey();
    try {
      const result = await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${m}` },
          UpdateExpression: 'SET aiQueryCount = if_not_exists(aiQueryCount, :zero) + :inc, #updated = :now',
          ExpressionAttributeNames: { '#updated': 'updatedAt' },
          ExpressionAttributeValues: { ':zero': 0, ':inc': 1, ':now': new Date().toISOString() },
          ReturnValues: 'UPDATED_NEW',
        }),
      );
      return Number(result.Attributes?.aiQueryCount ?? 0);
    } catch (e) {
      throw new DatabaseError('Increment usage failed', e);
    }
  }

  async getMobileMoneyReconCount(businessId: string, month?: string): Promise<number> {
    const m = month ?? this.monthKey();
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${m}` },
        }),
      );
      return Number(result.Item?.mobileMoneyReconCount ?? 0);
    } catch (e) {
      throw new DatabaseError('Get usage failed', e);
    }
  }

  async incrementMobileMoneyRecon(businessId: string): Promise<number> {
    const m = this.monthKey();
    try {
      const result = await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${m}` },
          UpdateExpression: 'SET mobileMoneyReconCount = if_not_exists(mobileMoneyReconCount, :zero) + :inc, #updated = :now',
          ExpressionAttributeNames: { '#updated': 'updatedAt' },
          ExpressionAttributeValues: { ':zero': 0, ':inc': 1, ':now': new Date().toISOString() },
          ReturnValues: 'UPDATED_NEW',
        }),
      );
      return Number(result.Attributes?.mobileMoneyReconCount ?? 0);
    } catch (e) {
      throw new DatabaseError('Increment usage failed', e);
    }
  }
}
