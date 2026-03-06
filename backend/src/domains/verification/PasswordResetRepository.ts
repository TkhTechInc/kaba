import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

const PK_PREFIX = 'PASSWORD_RESET#';
const TTL_MINUTES = 60;

export interface PasswordResetRecord {
  email: string;
  expiresAt: string;
}

export class PasswordResetRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async save(token: string, email: string): Promise<void> {
    const normalized = email.toLowerCase().trim();
    if (!normalized) throw new Error('Invalid email');

    const now = Date.now();
    const expiresAt = new Date(now + TTL_MINUTES * 60 * 1000).toISOString();
    const ttl = Math.floor(now / 1000) + TTL_MINUTES * 60;

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `${PK_PREFIX}${token}`,
          sk: 'META',
          entityType: 'PASSWORD_RESET',
          email: normalized,
          expiresAt,
          ttl,
        },
      }),
    );
  }

  async get(token: string): Promise<PasswordResetRecord | null> {
    if (!token?.trim()) return null;

    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `${PK_PREFIX}${token.trim()}`, sk: 'META' },
      }),
    );

    const item = result.Item;
    if (!item?.email) return null;

    return {
      email: String(item.email),
      expiresAt: String(item.expiresAt),
    };
  }

  async delete(token: string): Promise<void> {
    if (!token?.trim()) return;

    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { pk: `${PK_PREFIX}${token.trim()}`, sk: 'META' },
      }),
    );
  }
}
