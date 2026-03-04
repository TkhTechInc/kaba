import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const PK_PREFIX = 'EMAIL_VERIFY#';

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export interface EmailVerificationRecord {
  pk: string;
  sk: string;
  code: string;
  email: string;
  expiresAt: string;
  ttl: number;
}

export class EmailVerificationRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async save(email: string, code: string, ttlMinutes: number): Promise<void> {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error('Invalid email');

    const now = Date.now();
    const expiresAt = new Date(now + ttlMinutes * 60 * 1000).toISOString();
    const ttl = Math.floor(now / 1000) + ttlMinutes * 60;

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `${PK_PREFIX}${normalized}`,
          sk: String(now),
          entityType: 'EMAIL_VERIFY',
          code,
          email: normalized,
          expiresAt,
          ttl,
        },
      }),
    );
  }

  async getLatest(email: string): Promise<EmailVerificationRecord | null> {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;

    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': `${PK_PREFIX}${normalized}` },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );

    const item = result.Items?.[0];
    if (!item) return null;

    return {
      pk: String(item.pk),
      sk: String(item.sk),
      code: String(item.code),
      email: String(item.email),
      expiresAt: String(item.expiresAt),
      ttl: Number(item.ttl),
    };
  }
}
