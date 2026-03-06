import { Injectable } from '@nestjs/common';
import { AuditService } from './AuditService';

export interface LeakageAnomaly {
  userId: string;
  hourWindow: string;
  invoiceCount: number;
  reconciliationCount: number;
  gap: number;
  severity: 'low' | 'medium' | 'high';
}

export interface LastActivityByUser {
  userId: string;
  lastTimestamp: string;
  actionCount: number;
}

export interface AnomalySummary {
  leakage: { anomalies: LeakageAnomaly[] };
  failedLoginsCount: number;
  deleteCount: number;
  lastActivityByUser: LastActivityByUser[];
}

@Injectable()
export class AuditAnomalyService {
  constructor(private readonly auditService: AuditService) {}

  /** Maximum pages fetched per anomaly scan (500 items/page × 20 = 10 000 logs max). */
  private static readonly MAX_PAGES = 20;

  /** Default anomaly window when no date range is provided: 30 days. */
  private static readonly DEFAULT_DAYS = 30;

  private resolveDateRange(from?: string, to?: string): { from: string; to: string } {
    if (from && to) return { from, to };
    const now = new Date();
    const start = new Date(now.getTime() - AuditAnomalyService.DEFAULT_DAYS * 24 * 60 * 60 * 1000);
    return { from: start.toISOString(), to: now.toISOString() };
  }

  /**
   * Build anomaly summary for a business: leakage anomalies, failed logins,
   * delete count, and last activity per user.
   * Scans at most MAX_PAGES × 500 = 10,000 audit logs to avoid unbounded latency.
   * Defaults to the last 30 days when no date range is specified.
   */
  async getAnomalySummary(
    businessId: string,
    from?: string,
    to?: string
  ): Promise<AnomalySummary> {
    const range = this.resolveDateRange(from, to);
    const invoiceCreatesByUserHour: Record<string, number> = {};
    const reconciliationCreatesByUserHour: Record<string, number> = {};
    let failedLoginsCount = 0;
    let deleteCount = 0;
    const userActivity: Record<string, { lastTimestamp: string; count: number }> = {};

    let lastKey: Record<string, unknown> | undefined;
    let pagesRead = 0;
    do {
      const result = await this.auditService.queryByBusiness(
        businessId,
        range.from,
        range.to,
        500,
        lastKey
      );
      lastKey = result.lastEvaluatedKey;
      pagesRead++;

      for (const log of result.items) {
        const hourWindow = log.timestamp.slice(0, 13);
        const key = `${log.userId}::${hourWindow}`;

        if (log.entityType === 'Invoice' && log.action === 'create') {
          invoiceCreatesByUserHour[key] = (invoiceCreatesByUserHour[key] ?? 0) + 1;
        }
        if (log.entityType === 'Reconciliation' && log.action === 'create') {
          reconciliationCreatesByUserHour[key] =
            (reconciliationCreatesByUserHour[key] ?? 0) + 1;
        }
        if (log.action === 'login.failed') {
          failedLoginsCount += 1;
        }
        if (log.action === 'delete') {
          deleteCount += 1;
        }

        const existing = userActivity[log.userId];
        if (!existing) {
          userActivity[log.userId] = { lastTimestamp: log.timestamp, count: 1 };
        } else {
          existing.count += 1;
          if (log.timestamp > existing.lastTimestamp) {
            existing.lastTimestamp = log.timestamp;
          }
        }
      }
    } while (lastKey && pagesRead < AuditAnomalyService.MAX_PAGES);

    const anomalies: LeakageAnomaly[] = [];
    for (const key of Object.keys(invoiceCreatesByUserHour)) {
      const invCount = invoiceCreatesByUserHour[key];
      const reconCount = reconciliationCreatesByUserHour[key] ?? 0;
      const gap = invCount - reconCount;

      if (gap >= 2 && invCount >= 3) {
        const [userId, hourWindow] = key.split('::');
        let severity: LeakageAnomaly['severity'] = 'low';
        if (gap >= 5 || invCount >= 10) severity = 'high';
        else if (gap >= 3) severity = 'medium';

        anomalies.push({
          userId,
          hourWindow: `${hourWindow}:00`,
          invoiceCount: invCount,
          reconciliationCount: reconCount,
          gap,
          severity,
        });
      }
    }
    anomalies.sort((a, b) => b.gap - a.gap);

    const lastActivityByUser: LastActivityByUser[] = Object.entries(userActivity)
      .map(([userId, { lastTimestamp, count }]) => ({
        userId,
        lastTimestamp,
        actionCount: count,
      }))
      .sort((a, b) => (b.lastTimestamp > a.lastTimestamp ? 1 : -1));

    return {
      leakage: { anomalies },
      failedLoginsCount,
      deleteCount,
      lastActivityByUser,
    };
  }
}
