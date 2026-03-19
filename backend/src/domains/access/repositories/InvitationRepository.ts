import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DatabaseError } from '@/shared/errors/DomainError';
import type { Invitation } from '../models/Invitation';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

const PK_BUSINESS_PREFIX = 'BUSINESS#';
const PK_INVTOKEN_PREFIX = 'INVTOKEN#';
const SK_INVITATION_PREFIX = 'INVITATION#';
const SK_META = 'META';

export class InvitationRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async create(input: {
    emailOrPhone: string;
    businessId: string;
    role: Invitation['role'];
    invitedBy?: string;
    expiresInHours?: number;
  }): Promise<Invitation> {
    const id = uuidv4();
    const token = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (input.expiresInHours ?? 168) * 60 * 60 * 1000,
    ).toISOString();

    const invitation: Invitation = {
      id,
      emailOrPhone: input.emailOrPhone,
      businessId: input.businessId,
      role: input.role,
      token,
      expiresAt,
      createdAt: now.toISOString(),
      invitedBy: input.invitedBy,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(invitation),
        }),
      );
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapTokenLookupToDynamoDB(invitation),
        }),
      );
      return invitation;
    } catch (e) {
      throw new DatabaseError('Create invitation failed', e);
    }
  }

  async getByToken(token: string): Promise<Invitation | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `${PK_INVTOKEN_PREFIX}${token}`,
            sk: SK_META,
          },
        }),
      );
      if (!result.Item) return null;
      return this.mapFromDynamoDB(result.Item);
    } catch (e) {
      throw new DatabaseError('Get invitation by token failed', e);
    }
  }

  async listByBusiness(businessId: string): Promise<Invitation[]> {
    const items: Invitation[] = [];
    let lastKey: Record<string, unknown> | undefined;
    try {
      do {
        const result = await this.docClient.send(
          new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
            ExpressionAttributeValues: {
              ':pk': `${PK_BUSINESS_PREFIX}${businessId}`,
              ':skPrefix': SK_INVITATION_PREFIX,
            },
            ExclusiveStartKey: lastKey,
          }),
        );
        const mapped = (result.Items ?? []).map((item) => this.mapFromDynamoDB(item));
        items.push(...mapped);
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);
      return items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    } catch (e) {
      throw new DatabaseError('List invitations failed', e);
    }
  }

  async delete(invitation: Invitation): Promise<void> {
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            pk: `${PK_BUSINESS_PREFIX}${invitation.businessId}`,
            sk: `${SK_INVITATION_PREFIX}${invitation.id}`,
          },
        }),
      );
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            pk: `${PK_INVTOKEN_PREFIX}${invitation.token}`,
            sk: SK_META,
          },
        }),
      );
    } catch (e) {
      throw new DatabaseError('Delete invitation failed', e);
    }
  }

  private mapToDynamoDB(inv: Invitation): Record<string, unknown> {
    return {
      pk: `${PK_BUSINESS_PREFIX}${inv.businessId}`,
      sk: `${SK_INVITATION_PREFIX}${inv.id}`,
      entityType: 'INVITATION',
      id: inv.id,
      emailOrPhone: inv.emailOrPhone,
      businessId: inv.businessId,
      role: inv.role,
      token: inv.token,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      invitedBy: inv.invitedBy,
    };
  }

  private mapTokenLookupToDynamoDB(inv: Invitation): Record<string, unknown> {
    return {
      pk: `${PK_INVTOKEN_PREFIX}${inv.token}`,
      sk: SK_META,
      entityType: 'INVITATION',
      id: inv.id,
      emailOrPhone: inv.emailOrPhone,
      businessId: inv.businessId,
      role: inv.role,
      token: inv.token,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      invitedBy: inv.invitedBy,
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): Invitation {
    return {
      id: String(item.id ?? ''),
      emailOrPhone: String(item.emailOrPhone ?? ''),
      businessId: String(item.businessId ?? ''),
      role: (item.role as Invitation['role']) ?? 'viewer',
      token: String(item.token ?? ''),
      expiresAt: String(item.expiresAt ?? ''),
      createdAt: String(item.createdAt ?? ''),
      invitedBy: item.invitedBy != null ? String(item.invitedBy) : undefined,
    };
  }
}
