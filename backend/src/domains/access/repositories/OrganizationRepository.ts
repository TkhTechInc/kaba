import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { DatabaseError } from '@/shared/errors/DomainError';
import type { Organization } from '../models/Organization';
import { v4 as uuidv4 } from 'uuid';

const PK_PREFIX = 'ORG#';
const SK_META = 'META';

export class OrganizationRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async getById(orgId: string): Promise<Organization | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: `${PK_PREFIX}${orgId}`, sk: SK_META },
        }),
      );
      if (!result.Item) return null;
      return this.mapFromDynamoDB(result.Item);
    } catch (e) {
      throw new DatabaseError('Get organization failed', e);
    }
  }

  async create(input: { name: string }): Promise<Organization> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const org: Organization = {
      id,
      name: input.name,
      createdAt: now,
    };
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(org),
          ConditionExpression: 'attribute_not_exists(pk)',
        }),
      );
      return org;
    } catch (e) {
      throw new DatabaseError('Create organization failed', e);
    }
  }

  private mapToDynamoDB(o: Organization): Record<string, unknown> {
    return {
      pk: `${PK_PREFIX}${o.id}`,
      sk: SK_META,
      entityType: 'ORGANIZATION',
      id: o.id,
      name: o.name,
      createdAt: o.createdAt,
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): Organization {
    const pk = String(item.pk ?? '');
    const id = item.id != null ? String(item.id) : pk.replace(PK_PREFIX, '');
    return {
      id,
      name: String(item.name ?? ''),
      createdAt: String(item.createdAt ?? ''),
    };
  }
}
