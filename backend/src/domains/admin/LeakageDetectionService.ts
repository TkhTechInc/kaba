import { Injectable } from '@nestjs/common';
import { AuditService } from '@/domains/audit/services/AuditService';

export interface LeakageAnomaly {
  userId: string;
  hourWindow: string;
  invoiceCount: number;
  reconciliationCount: number;
  gap: number;
  severity: 'low' | 'medium' | 'high';
}

@Injectable()
export class LeakageDetectionService {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Detect potential internal fraud: users who created many invoices but had
   * few matching MoMo reconciliations in the same hour.
   */
  async getLeakageReport(
    businessId: string,
    from?: string,
    to?: string
  ): Promise<{ anomalies: LeakageAnomaly[] }> {
    const invoiceCreatesByUserHour: Record<string, number> = {};
    const reconciliationCreatesByUserHour: Record<string, number> = {};

    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await this.auditService.queryByBusiness(
        businessId,
        from,
        to,
        500,
        lastKey
      );
      lastKey = result.lastEvaluatedKey;

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
      }
    } while (lastKey);

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
    return { anomalies };
  }
}
