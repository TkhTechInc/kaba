import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { DYNAMODB_CLIENT, DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { ReceiptStorageService } from '@/domains/receipts/ReceiptStorageService';
import type { Business } from '@/domains/ledger/models/Business';

export interface DetailedHealthResult {
  status: 'ok' | 'degraded';
  timestamp: string;
  dynamodb: { ok: boolean; latencyMs?: number };
  s3?: { configured: boolean; ok?: boolean; latencyMs?: number };
}

export interface AdminMetricsResult {
  businessesCount: number;
  ledgerEntriesCount: number;
  invoicesCount: number;
  note: string;
}

export interface AdminActivityResult {
  items: Array<{
    id: string;
    businessId: string;
    type: string;
    amount: number;
    currency: string;
    description: string;
    category: string;
    date: string;
    createdAt: string;
  }>;
  lastEvaluatedKey?: Record<string, unknown>;
}

export interface AdminSummaryResult {
  businessesCount: number;
  ledgerEntriesCount: number;
  invoicesCount: number;
  recentActivityCount: number;
  timestamp: string;
}

@Injectable()
export class AdminMetricsService {
  constructor(
    @Inject(DYNAMODB_CLIENT) private readonly ddbClient: DynamoDBClient,
    @Inject(DYNAMODB_DOC_CLIENT) private readonly docClient: DynamoDBDocumentClient,
    @Optional() @Inject(ConfigService) private readonly config: ConfigService | null,
    private readonly ledgerRepo: LedgerRepository,
    private readonly receiptStorage: ReceiptStorageService,
  ) {}

  async getDetailedHealth(): Promise<DetailedHealthResult> {
    const timestamp = new Date().toISOString();
    const dynamoStart = Date.now();
    let dynamoOk = false;
    try {
      await this.ddbClient.send(new ListTablesCommand({ Limit: 1 }));
      dynamoOk = true;
    } catch {
      dynamoOk = false;
    }
    const dynamoLatency = Date.now() - dynamoStart;

    const result: DetailedHealthResult = {
      status: dynamoOk ? 'ok' : 'degraded',
      timestamp,
      dynamodb: { ok: dynamoOk, latencyMs: dynamoLatency },
    };

    if (this.receiptStorage.isConfigured()) {
      const s3Start = Date.now();
      let s3Ok = false;
      try {
        const bucket = this.config?.get<string>('s3.receiptsBucket') || process.env['S3_RECEIPTS_BUCKET'] || '';
        const s3 = new S3Client({ region: this.config?.get<string>('region') || process.env['AWS_REGION'] || 'af-south-1' });
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
        s3Ok = true;
      } catch {
        s3Ok = false;
      }
      const s3Latency = Date.now() - s3Start;
      result.s3 = { configured: true, ok: s3Ok, latencyMs: s3Latency };
      if (!s3Ok) result.status = 'degraded';
    } else {
      result.s3 = { configured: false };
    }

    return result;
  }

  async getMetrics(): Promise<AdminMetricsResult> {
    const ledgerTable = this.config?.get<string>('dynamodb.ledgerTable') ?? process.env['DYNAMODB_LEDGER_TABLE'] ?? 'QuickBooks-Ledger-dev';
    const invoicesTable = this.config?.get<string>('dynamodb.invoicesTable') ?? process.env['DYNAMODB_INVOICES_TABLE'] ?? 'QuickBooks-Invoices-dev';
    const scanLimit = 1000;

    let businessesCount = 0;
    let ledgerEntriesCount = 0;
    let invoicesCount = 0;

    try {
      const [businessesRes, ledgerRes, invoicesRes] = await Promise.all([
        this.docClient.send(
          new ScanCommand({
            TableName: ledgerTable,
            FilterExpression: 'entityType = :et',
            ExpressionAttributeValues: { ':et': 'BUSINESS' },
            Limit: scanLimit,
          })
        ),
        this.docClient.send(
          new ScanCommand({
            TableName: ledgerTable,
            FilterExpression: 'entityType = :et',
            ExpressionAttributeValues: { ':et': 'LEDGER' },
            Limit: scanLimit,
          })
        ),
        this.docClient.send(
          new ScanCommand({
            TableName: invoicesTable,
            Limit: scanLimit,
          })
        ),
      ]);

      businessesCount = businessesRes.Count ?? 0;
      ledgerEntriesCount = ledgerRes.Count ?? 0;
      invoicesCount = invoicesRes.Count ?? 0;
    } catch {
      // return zeros on error
    }

    return {
      businessesCount,
      ledgerEntriesCount,
      invoicesCount,
      note: `Approximate counts (Scan Limit ${scanLimit}). Use pagination for full counts.`,
    };
  }

  async getActivity(
    limit: number = 50,
    lastEvaluatedKey?: Record<string, unknown>
  ): Promise<AdminActivityResult> {
    const { items, lastEvaluatedKey: nextKey } =
      await this.ledgerRepo.scanRecentEntriesAcrossBusinesses(limit, lastEvaluatedKey);
    return {
      items: items.map((e) => ({
        id: e.id,
        businessId: e.businessId,
        type: e.type,
        amount: e.amount,
        currency: e.currency,
        description: e.description,
        category: e.category,
        date: e.date,
        createdAt: e.createdAt,
      })),
      lastEvaluatedKey: nextKey,
    };
  }

  async getSummary(): Promise<AdminSummaryResult> {
    const metrics = await this.getMetrics();
    const activity = await this.getActivity(20);
    return {
      businessesCount: metrics.businessesCount,
      ledgerEntriesCount: metrics.ledgerEntriesCount,
      invoicesCount: metrics.invoicesCount,
      recentActivityCount: activity.items.length,
      timestamp: new Date().toISOString(),
    };
  }

  async listBusinesses(
    limit: number = 50,
    lastEvaluatedKey?: Record<string, unknown>,
  ): Promise<{ items: Business[]; lastEvaluatedKey?: Record<string, unknown> }> {
    const ledgerTable = this.config?.get<string>('dynamodb.ledgerTable') ?? process.env['DYNAMODB_LEDGER_TABLE'] ?? 'QuickBooks-Ledger-dev';
    const result = await this.docClient.send(
      new ScanCommand({
        TableName: ledgerTable,
        FilterExpression: 'entityType = :et',
        ExpressionAttributeValues: { ':et': 'BUSINESS' },
        Limit: limit,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      }),
    );
    const items = (result.Items || []).map((item) => this.mapBusinessFromDynamoDB(item));
    return {
      items,
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  private mapBusinessFromDynamoDB(item: Record<string, unknown>): Business {
    return {
      id: String(item.id ?? item.pk ?? ''),
      tier: (item.tier as Business['tier']) ?? 'free',
      name: item.name != null ? String(item.name) : undefined,
      countryCode: item.countryCode != null ? String(item.countryCode) : undefined,
      currency: item.currency != null ? String(item.currency) : undefined,
      organizationId: item.organizationId != null ? String(item.organizationId) : undefined,
      createdAt: String(item.createdAt ?? ''),
      updatedAt: String(item.updatedAt ?? ''),
    };
  }
}
