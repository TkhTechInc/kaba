import { Injectable } from '@nestjs/common';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { DatabaseError } from '@/shared/errors/DomainError';

export interface MoMoTransaction {
  amount: number;
  currency: string;
  date: string; // YYYY-MM-DD
  rawLine: string;
}

export interface MoMoReconRecord {
  businessId: string;
  month: string; // YYYY-MM
  momoTotal: number;
  declaredTotal: number;
  currency: string;
  rate: number; // 0–1, momoTotal / declaredTotal
  transactionCount: number;
  uploadedAt: string;
}

const SK_PREFIX = 'MOMO_RECON#';

@Injectable()
export class MoMoReconciliationService {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /**
   * Parse raw MoMo SMS text and extract transactions.
   * Supports XOF (FCFA/CFA/F CFA), GHS (GH₵/GHC/GHS), NGN (₦/NGN/Naira).
   * Each line is treated as one SMS.
   */
  parseSmsText(rawText: string): MoMoTransaction[] {
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    const results: MoMoTransaction[] = [];

    // Currency + amount patterns
    const patterns: Array<{ currency: string; regex: RegExp }> = [
      // XOF: "5,000 FCFA", "5000 F CFA", "5 000 CFA", "FCFA 5000"
      { currency: 'XOF', regex: /(?:FCFA|F\s*CFA|CFA)\s*([\d,\s]+)|(\d[\d,\s]*)\s*(?:FCFA|F\s*CFA|CFA)/i },
      // GHS: "GH₵50.00", "GHC 50", "50 GHS"
      { currency: 'GHS', regex: /(?:GH[C₵S])\s*([\d,\.]+)|([\d,\.]+)\s*(?:GH[C₵S])/i },
      // NGN: "₦5,000", "NGN 5000", "5000 Naira"
      { currency: 'NGN', regex: /(?:₦|NGN|Naira)\s*([\d,\.]+)|([\d,\.]+)\s*(?:NGN|Naira)/i },
    ];

    // Date patterns: "12/03/2026", "2026-03-12", "12 March 2026", "Mar 12, 2026"
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{2})\/(\d{2})\/(\d{4})/,
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i,
    ];

    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };

    const today = new Date().toISOString().slice(0, 10);

    for (const line of lines) {
      let amount: number | null = null;
      let currency = 'XOF';

      for (const p of patterns) {
        const m = p.regex.exec(line);
        if (m) {
          const raw = (m[1] ?? m[2] ?? '').replace(/[\s,]/g, '');
          const parsed = parseFloat(raw);
          if (!isNaN(parsed) && parsed > 0) {
            amount = parsed;
            currency = p.currency;
            break;
          }
        }
      }

      if (amount === null) continue;

      // Extract date
      let date = today;
      for (const dp of datePatterns) {
        const dm = dp.exec(line);
        if (dm) {
          if (dp === datePatterns[0]) {
            date = dm[1];
          } else if (dp === datePatterns[1]) {
            date = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
          } else if (dp === datePatterns[2]) {
            const mon = monthMap[dm[2].toLowerCase().slice(0, 3)] ?? '01';
            date = `${dm[3]}-${mon}-${dm[1].padStart(2, '0')}`;
          } else if (dp === datePatterns[3]) {
            const mon = monthMap[dm[1].toLowerCase().slice(0, 3)] ?? '01';
            date = `${dm[3]}-${mon}-${dm[2].padStart(2, '0')}`;
          }
          break;
        }
      }

      results.push({ amount, currency, date, rawLine: line });
    }

    return results;
  }

  /** Group parsed transactions by YYYY-MM and sum amounts. */
  groupByMonth(transactions: MoMoTransaction[]): Record<string, { total: number; count: number; currency: string }> {
    const result: Record<string, { total: number; count: number; currency: string }> = {};
    for (const tx of transactions) {
      const month = tx.date.slice(0, 7);
      if (!result[month]) result[month] = { total: 0, count: 0, currency: tx.currency };
      result[month].total += tx.amount;
      result[month].count += 1;
    }
    return result;
  }

  /** Save a reconciliation record to DynamoDB. */
  async saveReconRecord(record: MoMoReconRecord): Promise<void> {
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: record.businessId,
            sk: `${SK_PREFIX}${record.month}`,
            entityType: 'MOMO_RECON',
            businessId: record.businessId,
            month: record.month,
            momoTotal: record.momoTotal,
            declaredTotal: record.declaredTotal,
            currency: record.currency,
            rate: record.rate,
            transactionCount: record.transactionCount,
            uploadedAt: record.uploadedAt,
          },
        }),
      );
    } catch (e) {
      throw new DatabaseError('Save MoMo reconciliation record failed', e);
    }
  }

  /** Get reconciliation record for a specific month. */
  async getReconRecord(businessId: string, month: string): Promise<MoMoReconRecord | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${month}` },
        }),
      );
      if (!result.Item) return null;
      const item = result.Item;
      return {
        businessId: String(item.businessId ?? ''),
        month: String(item.month ?? ''),
        momoTotal: Number(item.momoTotal ?? 0),
        declaredTotal: Number(item.declaredTotal ?? 0),
        currency: String(item.currency ?? 'XOF'),
        rate: Number(item.rate ?? 0),
        transactionCount: Number(item.transactionCount ?? 0),
        uploadedAt: String(item.uploadedAt ?? ''),
      };
    } catch (e) {
      throw new DatabaseError('Get MoMo reconciliation record failed', e);
    }
  }

  /**
   * Compute average reconciliation rate across available months (0–1).
   * Returns 0.5 (neutral) if no records exist.
   */
  async getAverageReconRate(businessId: string, months: string[]): Promise<number> {
    if (months.length === 0) return 0.5;

    const records = await Promise.all(
      months.map((m) => this.getReconRecord(businessId, m)),
    );

    const valid = records.filter((r): r is MoMoReconRecord => r !== null && r.declaredTotal > 0);
    if (valid.length === 0) return 0.5;

    const avgRate = valid.reduce((sum, r) => sum + r.rate, 0) / valid.length;
    return Math.min(1, avgRate);
  }
}
