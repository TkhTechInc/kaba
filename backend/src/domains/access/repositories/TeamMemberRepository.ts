import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DatabaseError } from '@/shared/errors/DomainError';
import type { TeamMember } from '../models/TeamMember';

const PK_ORG_PREFIX = 'ORG#';
const PK_BUSINESS_PREFIX = 'BUSINESS#';
const PK_USER_PREFIX = 'USER#';
const SK_MEMBER_PREFIX = 'MEMBER#';
const SK_BUSINESS_PREFIX = 'BUSINESS#';

export class TeamMemberRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /** Get member by businessId and userId */
  async getByBusinessAndUser(businessId: string, userId: string): Promise<TeamMember | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `${PK_BUSINESS_PREFIX}${businessId}`,
            sk: `${SK_MEMBER_PREFIX}${userId}`,
          },
        }),
      );
      if (!result.Item) return null;
      return this.mapFromDynamoDB(result.Item);
    } catch (e) {
      throw new DatabaseError('Get team member failed', e);
    }
  }

  /** Get member by organizationId and userId */
  async getByOrgAndUser(organizationId: string, userId: string): Promise<TeamMember | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `${PK_ORG_PREFIX}${organizationId}`,
            sk: `${SK_MEMBER_PREFIX}${userId}`,
          },
        }),
      );
      if (!result.Item) return null;
      return this.mapFromDynamoDB(result.Item);
    } catch (e) {
      throw new DatabaseError('Get team member failed', e);
    }
  }

  /** List all members for a business. Query pk=BUSINESS#businessId, begins_with sk=MEMBER# */
  async listMembersForBusiness(businessId: string): Promise<TeamMember[]> {
    const members: TeamMember[] = [];
    let lastKey: Record<string, unknown> | undefined;
    try {
      do {
        const result = await this.docClient.send(
          new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
            ExpressionAttributeValues: {
              ':pk': `${PK_BUSINESS_PREFIX}${businessId}`,
              ':skPrefix': SK_MEMBER_PREFIX,
            },
            ExclusiveStartKey: lastKey,
          }),
        );
        const items = (result.Items ?? []).map((item) => this.mapFromDynamoDB(item));
        members.push(...items);
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);
      return members;
    } catch (e) {
      throw new DatabaseError('List members for business failed', e);
    }
  }

  /** List all businesses the user has access to */
  async listBusinessesForUser(userId: string): Promise<TeamMember[]> {
    const members: TeamMember[] = [];
    let lastKey: Record<string, unknown> | undefined;
    try {
      do {
        const result = await this.docClient.send(
          new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
            ExpressionAttributeValues: {
              ':pk': `${PK_USER_PREFIX}${userId}`,
              ':skPrefix': SK_BUSINESS_PREFIX,
            },
            ExclusiveStartKey: lastKey,
          }),
        );
        const items = (result.Items ?? []).map((item) => this.mapFromDynamoDB(item));
        members.push(...items);
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);
      return members;
    } catch (e) {
      throw new DatabaseError('List businesses for user failed', e);
    }
  }

  /** Add member to business (writes both BUSINESS# and USER# items for bidirectional lookup) */
  async addBusinessMember(member: TeamMember): Promise<TeamMember> {
    if (!member.businessId || !member.userId) {
      throw new DatabaseError('businessId and userId are required');
    }
    const now = member.createdAt ?? new Date().toISOString();
    const m: TeamMember = { ...member, createdAt: now };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapBusinessMemberToDynamoDB(m),
        }),
      );
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapUserBusinessToDynamoDB(m),
        }),
      );
      return m;
    } catch (e) {
      throw new DatabaseError('Add business member failed', e);
    }
  }

  /** Update a business member's role. Updates both BUSINESS# and USER# items. */
  async updateBusinessMemberRole(
    businessId: string,
    userId: string,
    role: TeamMember['role'],
  ): Promise<TeamMember> {
    const existing = await this.getByBusinessAndUser(businessId, userId);
    if (!existing) {
      throw new DatabaseError('Team member not found');
    }
    const updated: TeamMember = { ...existing, role };
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: this.mapBusinessMemberToDynamoDB(updated),
      }),
    );
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: this.mapUserBusinessToDynamoDB(updated),
      }),
    );
    return updated;
  }

  /** Add member to organization */
  async addOrgMember(member: TeamMember): Promise<TeamMember> {
    if (!member.organizationId || !member.userId) {
      throw new DatabaseError('organizationId and userId are required');
    }
    const now = member.createdAt ?? new Date().toISOString();
    const m: TeamMember = { ...member, createdAt: now };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapOrgMemberToDynamoDB(m),
        }),
      );
      return m;
    } catch (e) {
      throw new DatabaseError('Add org member failed', e);
    }
  }

  private mapBusinessMemberToDynamoDB(m: TeamMember): Record<string, unknown> {
    return {
      pk: `${PK_BUSINESS_PREFIX}${m.businessId}`,
      sk: `${SK_MEMBER_PREFIX}${m.userId}`,
      entityType: 'TEAM_MEMBER',
      userId: m.userId,
      businessId: m.businessId,
      role: m.role,
      createdAt: m.createdAt,
    };
  }

  private mapUserBusinessToDynamoDB(m: TeamMember): Record<string, unknown> {
    return {
      pk: `${PK_USER_PREFIX}${m.userId}`,
      sk: `${SK_BUSINESS_PREFIX}${m.businessId}`,
      entityType: 'TEAM_MEMBER',
      userId: m.userId,
      businessId: m.businessId,
      role: m.role,
      createdAt: m.createdAt,
    };
  }

  private mapOrgMemberToDynamoDB(m: TeamMember): Record<string, unknown> {
    return {
      pk: `${PK_ORG_PREFIX}${m.organizationId}`,
      sk: `${SK_MEMBER_PREFIX}${m.userId}`,
      entityType: 'TEAM_MEMBER',
      userId: m.userId,
      organizationId: m.organizationId,
      role: m.role,
      createdAt: m.createdAt,
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): TeamMember {
    return {
      userId: String(item.userId ?? ''),
      organizationId: item.organizationId != null ? String(item.organizationId) : undefined,
      businessId: item.businessId != null ? String(item.businessId) : undefined,
      role: (item.role as TeamMember['role']) ?? 'viewer',
      createdAt: String(item.createdAt ?? ''),
    };
  }
}
