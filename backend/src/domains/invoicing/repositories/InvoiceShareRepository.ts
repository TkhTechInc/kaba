import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { DatabaseError } from '@/shared/errors/DomainError';

export interface InvoiceShareRecord {
  token: string;
  invoiceId: string;
  businessId: string;
  expiresAt: string;
  createdAt: string;
}

const TOKEN_PK_PREFIX = 'INVOICE_TOKEN#';
// Lookup record: pk=INVOICE_SHARE_BY_INVOICE#{invoiceId}, sk=META
// Stores the most recent token so callers can reuse it instead of minting a new one each time.
const INVOICE_LOOKUP_PREFIX = 'INVOICE_SHARE_BY_INVOICE#';

/**
 * Repository for storing invoice share tokens.
 * Uses single-table design with ledger table (same as TrustShareService).
 * Lookup: pk=INVOICE_TOKEN#{token}, sk=META
 */
export class InvoiceShareRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async create(
    token: string,
    invoiceId: string,
    businessId: string,
    expiresAt: string
  ): Promise<InvoiceShareRecord> {
    const now = new Date().toISOString();
    const ttlEpoch = Math.floor(new Date(expiresAt).getTime() / 1000);

    const record: InvoiceShareRecord = {
      token,
      invoiceId,
      businessId,
      expiresAt,
      createdAt: now,
    };

    try {
      // Write the token record
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: `${TOKEN_PK_PREFIX}${token}`,
            sk: 'META',
            entityType: 'INVOICE_SHARE',
            ...record,
            ttl: ttlEpoch,
          },
        })
      );
      // Write a lookup record keyed by invoiceId so we can find the latest token without a scan
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: `${INVOICE_LOOKUP_PREFIX}${invoiceId}`,
            sk: 'META',
            entityType: 'INVOICE_SHARE_LOOKUP',
            token,
            invoiceId,
            businessId,
            expiresAt,
            createdAt: now,
            ttl: ttlEpoch,
          },
        })
      );
      return record;
    } catch (e) {
      throw new DatabaseError('Create invoice share token failed', e);
    }
  }

  /** Find the most recent share token for an invoice (for deduplication). */
  async getByInvoiceId(invoiceId: string): Promise<InvoiceShareRecord | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `${INVOICE_LOOKUP_PREFIX}${invoiceId}`,
            sk: 'META',
          },
        })
      );
      if (!result.Item) return null;
      const item = result.Item;
      const tokenVal = String(item.token ?? '');
      const bId = String(item.businessId ?? '');
      if (!tokenVal || !bId) return null;
      return {
        token: tokenVal,
        invoiceId: String(item.invoiceId ?? invoiceId),
        businessId: bId,
        expiresAt: String(item.expiresAt ?? ''),
        createdAt: String(item.createdAt ?? ''),
      };
    } catch (e) {
      throw new DatabaseError('Get invoice share by invoiceId failed', e);
    }
  }

  async getByToken(token: string): Promise<InvoiceShareRecord | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `${TOKEN_PK_PREFIX}${token}`,
            sk: 'META',
          },
        })
      );

      if (!result.Item) return null;

      const item = result.Item;
      const tokenVal = String(item.token ?? '');
      const invoiceId = String(item.invoiceId ?? '');
      const businessId = String(item.businessId ?? '');
      // Guard against schema drift — all key fields must be present
      if (!tokenVal || !invoiceId || !businessId) return null;
      return {
        token: tokenVal,
        invoiceId,
        businessId,
        expiresAt: String(item.expiresAt ?? ''),
        createdAt: String(item.createdAt ?? ''),
      };
    } catch (e) {
      throw new DatabaseError('Get invoice share token failed', e);
    }
  }
}
