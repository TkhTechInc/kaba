import { Injectable } from '@nestjs/common';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';
import { InvoiceRepository } from '@/domains/invoicing/repositories/InvoiceRepository';
import { CustomerRepository } from '@/domains/invoicing/repositories/CustomerRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { MoMoReconciliationService } from './MoMoReconciliationService';
import type { LedgerEntry } from '@/domains/ledger/models/LedgerEntry';
import type { Debt } from '@/domains/debts/models/Debt';
import type { Invoice } from '@/domains/invoicing/models/Invoice';

export interface BusinessTrustScoreResult {
  businessId: string;
  trustScore: number;
  breakdown: {
    repaymentVelocity: number;
    transactionRecency: number;
    momoReconciliation: number;
    customerRetention: number;
    networkDiversity: number;
  };
  marketDayAwarenessApplied: boolean;
  recommendation: 'excellent' | 'good' | 'fair' | 'poor';
  scoredAt: string;
  sectorBenchmark?: {
    averageTrustScore: number;
    businessCount: number;
    note: string;
  };
}

@Injectable()
export class BusinessTrustScoreService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly debtRepository: DebtRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly momoReconciliationService: MoMoReconciliationService,
    private readonly businessRepository: BusinessRepository,
  ) {}

  async calculate(businessId: string): Promise<BusinessTrustScoreResult> {
    const now = new Date();

    const business = await this.businessRepository.getById(businessId);
    const marketDayCycle = business?.marketDayCycle ?? null;

    const [
      repaymentVelocity,
      { score: transactionRecency, marketDayApplied },
      momoReconciliation,
      customerRetention,
      networkDiversity,
    ] = await Promise.all([
      this.scoreRepaymentVelocity(businessId),
      this.scoreTransactionRecency(businessId, now, marketDayCycle),
      this.scoreMomoReconciliation(businessId, now),
      this.scoreCustomerRetention(businessId),
      this.scoreNetworkDiversity(businessId),
    ]);

    const trustScore = Math.round(
      repaymentVelocity * 0.35 +
      transactionRecency * 0.25 +
      momoReconciliation * 0.20 +
      customerRetention * 0.15 +
      networkDiversity * 0.05,
    );

    const recommendation = this.toRecommendation(trustScore);

    const { businessCount, averageTrustScore } = await this.businessRepository.getSectorBenchmark();

    return {
      businessId,
      trustScore,
      breakdown: {
        repaymentVelocity,
        transactionRecency,
        momoReconciliation,
        customerRetention,
        networkDiversity,
      },
      marketDayAwarenessApplied: marketDayApplied,
      recommendation,
      scoredAt: now.toISOString(),
      sectorBenchmark: {
        averageTrustScore,
        businessCount,
        note:
          businessCount > 0
            ? 'Sector benchmark is anonymized aggregate data. Full data in Kaba Enterprise.'
            : 'Sector benchmark will appear once more businesses have trust scores.',
      },
    };
  }

  async calculateAndSave(businessId: string): Promise<BusinessTrustScoreResult> {
    const result = await this.calculate(businessId);
    await this.businessRepository.updateTrustScore(businessId, result.trustScore);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Signal: Repayment Velocity (35%)
  // ---------------------------------------------------------------------------

  private async scoreRepaymentVelocity(businessId: string): Promise<number> {
    const { items: debts } = await this.debtRepository.listByBusiness(businessId, 1, 1000);
    const paidDebts = debts.filter((d: Debt) => d.status === 'paid');

    if (paidDebts.length === 0) return 50;

    const daysDiffs = paidDebts.map((d: Debt) => {
      const dueMs = new Date(d.dueDate).getTime();
      const paidMs = new Date(d.updatedAt).getTime();
      return (dueMs - paidMs) / 86_400_000;
    });

    const avg = daysDiffs.reduce((a, b) => a + b, 0) / daysDiffs.length;
    return this.mapRepaymentDaysToScore(avg);
  }

  /**
   * Linear interpolation:
   *   avg >= 7  → 100
   *   avg == 0  → 70
   *   avg <= -30 → 0
   */
  private mapRepaymentDaysToScore(avgDays: number): number {
    if (avgDays >= 7) return 100;
    if (avgDays >= 0) return 70 + (avgDays / 7) * 30;
    if (avgDays >= -30) return 70 * (1 + avgDays / 30);
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Signal: Transaction Recency (25%)
  // ---------------------------------------------------------------------------

  private async scoreTransactionRecency(
    businessId: string,
    now: Date,
    marketDayCycle: number | null,
  ): Promise<{ score: number; marketDayApplied: boolean }> {
    const cutoff90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const cutoff45 = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

    const entries: LedgerEntry[] = await this.ledgerRepository.listByBusinessAndDateRange(
      businessId,
      cutoff90.toISOString(),
      now.toISOString(),
    );

    const recentCount = entries.filter(e => new Date(e.date) >= cutoff45).length;
    const olderCount = entries.filter(e => new Date(e.date) < cutoff45).length;

    let marketDayApplied = false;

    if (olderCount === 0 && marketDayCycle != null && marketDayCycle > 0) {
      // Check if gap between transactions aligns with the market day cycle
      const sortedDates = entries
        .map(e => new Date(e.date).getTime())
        .sort((a, b) => a - b);

      const gapAligned = sortedDates.some((_, i) => {
        if (i === 0) return false;
        const gapDays = (sortedDates[i] - sortedDates[i - 1]) / 86_400_000;
        const remainder = gapDays % marketDayCycle;
        return remainder <= 1 || remainder >= marketDayCycle - 1;
      });

      if (gapAligned) {
        marketDayApplied = true;
        return { score: 50, marketDayApplied };
      }
    }

    const score = Math.min(100, (recentCount / Math.max(olderCount, 1)) * 100);
    return { score, marketDayApplied };
  }

  // ---------------------------------------------------------------------------
  // Signal: MoMo Reconciliation (20%)
  // ---------------------------------------------------------------------------

  private async scoreMomoReconciliation(businessId: string, now: Date): Promise<number> {
    const months: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const rate = await this.momoReconciliationService.getAverageReconRate(businessId, months);
    return Math.min(100, Math.max(0, rate * 100));
  }

  // ---------------------------------------------------------------------------
  // Signal: Customer Retention (15%)
  // ---------------------------------------------------------------------------

  private async scoreCustomerRetention(businessId: string): Promise<number> {
    let invoices: Invoice[];
    try {
      invoices = await (this.invoiceRepository as any).listAllByBusiness(businessId);
    } catch {
      const { items } = await this.invoiceRepository.listByBusiness(businessId, 1, 1000);
      invoices = items;
    }

    if (invoices.length === 0) return 0;

    // Map customerId → set of year-month strings
    const customerMonths = new Map<string, Set<string>>();
    for (const inv of invoices) {
      const ym = inv.createdAt.slice(0, 7); // "YYYY-MM"
      if (!customerMonths.has(inv.customerId)) {
        customerMonths.set(inv.customerId, new Set());
      }
      customerMonths.get(inv.customerId)!.add(ym);
    }

    const totalCustomers = customerMonths.size;
    const returningCustomers = [...customerMonths.values()].filter(months => months.size >= 2).length;

    return (returningCustomers / Math.max(totalCustomers, 1)) * 100;
  }

  // ---------------------------------------------------------------------------
  // Signal: Network Diversity (5%)
  // ---------------------------------------------------------------------------

  private async scoreNetworkDiversity(businessId: string): Promise<number> {
    const customers = await this.customerRepository.listAllByBusiness(businessId);
    return Math.min(100, (customers.length / 50) * 100);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toRecommendation(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }
}
