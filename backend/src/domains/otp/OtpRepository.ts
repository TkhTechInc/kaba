import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const PK_PREFIX = 'OTP#';

export interface OtpRecord {
  pk: string;
  sk: string;
  code: string;
  phone: string;
  expiresAt: string;
  ttl: number;
}

export class OtpRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async save(phone: string, code: string, ttlMinutes: number): Promise<void> {
    const normalized = this.normalizePhone(phone);
    if (!normalized) throw new Error('Invalid phone number');

    const now = Date.now();
    const expiresAt = new Date(now + ttlMinutes * 60 * 1000).toISOString();
    const ttl = Math.floor(now / 1000) + ttlMinutes * 60;

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `${PK_PREFIX}${normalized}`,
          sk: String(now),
          entityType: 'OTP',
          code,
          phone: normalized,
          expiresAt,
          ttl,
        },
      }),
    );
  }

  async getLatest(phone: string): Promise<OtpRecord | null> {
    const normalized = this.normalizePhone(phone);
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
      phone: String(item.phone),
      expiresAt: String(item.expiresAt),
      ttl: Number(item.ttl),
    };
  }

  private normalizePhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) return null;
    if (digits.startsWith('0') && digits.length >= 11) return `+234${digits.slice(1)}`;
    if (digits.length === 10 && digits[0] >= '2' && digits[0] <= '9') return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (!phone.startsWith('+')) return `+${digits}`;
    return phone;
  }
}
