import { Injectable } from '@nestjs/common';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';

export interface CreditScoreBreakdown {
  transactionFrequency: number;
  repaymentVelocity: number;
  debtRepaymentRatio: number; // alias for repaymentVelocity — backward compat
  volumeConsistency: number;
  transactionRecency: number;
}

export interface CreditScoreResult {
  customerId: string;
  trustScore: number;
  breakdown: CreditScoreBreakdown;
  recommendation: 'approve' | 'review' | 'deny';
  period: { start: string; end: string };
  scoredAt: string;
}

@Injectable()
export class CreditScoreService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly debtRepository: DebtRepository,
  ) {}

  async getCreditScore(
    businessId: string,
    customerId: string,
    fromDate: string,
    toDate: string,
  ): Promise<CreditScoreResult> {
    const [ledgerEntries, allDebts] = await Promise.all([
      this.ledgerRepository.listByBusinessAndDateRange(businessId, fromDate, toDate),
      this.debtRepository.listByBusiness(businessId, 1, 500),
    ]);

    // LedgerEntry has no customerId field; use all non-deleted sale entries as the
    // business-level signal for this customer's general creditworthiness.
    const customerEntries = ledgerEntries.filter(
      (e) => e.type === 'sale' && !e.deletedAt,
    );

    const periodDays = Math.max(
      1,
      Math.ceil(
        (new Date(toDate).getTime() - new Date(fromDate).getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    );

    // --- Transaction Frequency (25%) ---
    const txCount = customerEntries.length;
    const txPerDay = txCount / periodDays;
    const frequencyScore = Math.min(100, Math.round(txPerDay * 100));

    // --- Repayment Velocity (35%) ---
    // For each paid debt: compute days between payment and due date.
    // +7 days early → 100, on-time (0) → 70, -30 days (30 days late) → 0.
    const customerDebts = allDebts.items.filter((d) => d.customerId === customerId);
    const paidDebts = customerDebts.filter((d) => d.status === 'paid');

    let repaymentVelocityScore: number;
    if (paidDebts.length === 0) {
      // No paid debts: treat no-debt history as neutral if no debts exist,
      // or penalise if there are outstanding debts.
      repaymentVelocityScore = customerDebts.length === 0 ? 70 : 0;
    } else {
      const velocityScores = paidDebts.map((d) => {
        const due = new Date(d.dueDate).getTime();
        const paid = new Date(d.updatedAt).getTime();
        const daysDiff = (due - paid) / (24 * 60 * 60 * 1000); // positive = paid early
        if (daysDiff >= 7) return 100;
        if (daysDiff >= 0) return 70 + Math.round((daysDiff / 7) * 30);
        // late: 0 at 30 days late, linear between 0 and -30
        return Math.max(0, Math.round(70 + (daysDiff / 30) * 70));
      });
      repaymentVelocityScore = Math.round(
        velocityScores.reduce((s, v) => s + v, 0) / velocityScores.length,
      );
    }

    // --- Volume Consistency (20%) ---
    const monthlyAmounts: Record<string, number> = {};
    for (const entry of customerEntries) {
      const month = entry.date.slice(0, 7);
      monthlyAmounts[month] = (monthlyAmounts[month] ?? 0) + entry.amount;
    }
    const amounts = Object.values(monthlyAmounts);
    const consistencyScore = this.computeConsistencyScore(amounts);

    // --- Transaction Recency (20%) ---
    // Compare tx count in the last 30 days of the period vs the first 30 days.
    const toTime = new Date(toDate).getTime();
    const fromTime = new Date(fromDate).getTime();
    const last30Cutoff = new Date(toTime - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const first30Cutoff = new Date(fromTime + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const recentCount = customerEntries.filter((e) => e.date >= last30Cutoff).length;
    const earlyCount = customerEntries.filter((e) => e.date <= first30Cutoff).length;
    const recencyScore = Math.min(
      100,
      Math.round((recentCount / Math.max(earlyCount, 1)) * 100),
    );

    // --- Weighted trust score ---
    const trustScore = Math.round(
      frequencyScore * 0.25 +
      repaymentVelocityScore * 0.35 +
      consistencyScore * 0.2 +
      recencyScore * 0.2,
    );

    let recommendation: 'approve' | 'review' | 'deny';
    if (trustScore >= 70) recommendation = 'approve';
    else if (trustScore >= 40) recommendation = 'review';
    else recommendation = 'deny';

    return {
      customerId,
      trustScore,
      breakdown: {
        transactionFrequency: frequencyScore,
        repaymentVelocity: repaymentVelocityScore,
        debtRepaymentRatio: repaymentVelocityScore,
        volumeConsistency: consistencyScore,
        transactionRecency: recencyScore,
      },
      recommendation,
      period: { start: fromDate, end: toDate },
      scoredAt: new Date().toISOString(),
    };
  }

  private computeConsistencyScore(amounts: number[]): number {
    if (amounts.length === 0) return 0;
    if (amounts.length === 1) return 50;
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    if (mean === 0) return 0;
    const variance =
      amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / amounts.length;
    const stddev = Math.sqrt(variance);
    const cv = stddev / mean;
    return Math.max(0, Math.round((1 - Math.min(cv, 1)) * 100));
  }
}
