import { Injectable } from '@nestjs/common';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';

export interface CreditScoreBreakdown {
  transactionFrequency: number;
  debtRepaymentRatio: number;
  volumeConsistency: number;
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

  /**
   * Compute a 0–100 Trust Score for a customer based on:
   *  - Transaction frequency  (weight: 40%) — how often they transact
   *  - Debt repayment ratio   (weight: 40%) — paid debts / total debts
   *  - Volume consistency     (weight: 20%) — low stddev of monthly amounts = reliable buyer
   */
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

    // Filter ledger entries for this customer (those linked via customerId or invoice ref)
    // We use all sale entries for the business as a proxy when no direct customerId link exists
    const customerEntries = ledgerEntries.filter(
      (e) => e.type === 'sale' && !e.deletedAt
    );

    const periodDays = Math.max(
      1,
      Math.ceil(
        (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (24 * 60 * 60 * 1000)
      )
    );

    // --- Transaction Frequency score (0–100) ---
    // Target: ≥1 transaction/day = 100, 0 = 0
    const txCount = customerEntries.length;
    const txPerDay = txCount / periodDays;
    const frequencyScore = Math.min(100, Math.round(txPerDay * 100));

    // --- Debt Repayment Ratio score (0–100) ---
    const customerDebts = allDebts.items.filter((d) => d.customerId === customerId);
    const totalDebts = customerDebts.length;
    const paidDebts = customerDebts.filter((d) => d.status === 'paid').length;
    const repaymentRatio = totalDebts === 0 ? 1 : paidDebts / totalDebts;
    const repaymentScore = Math.round(repaymentRatio * 100);

    // --- Volume Consistency score (0–100) ---
    // Group sale amounts by month; compute coefficient of variation (lower = more consistent)
    const monthlyAmounts: Record<string, number> = {};
    for (const entry of customerEntries) {
      const month = entry.date.slice(0, 7);
      monthlyAmounts[month] = (monthlyAmounts[month] ?? 0) + entry.amount;
    }
    const amounts = Object.values(monthlyAmounts);
    const consistencyScore = this.computeConsistencyScore(amounts);

    // --- Weighted trust score ---
    const trustScore = Math.round(
      frequencyScore * 0.4 +
      repaymentScore * 0.4 +
      consistencyScore * 0.2
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
        debtRepaymentRatio: repaymentScore,
        volumeConsistency: consistencyScore,
      },
      recommendation,
      period: { start: fromDate, end: toDate },
      scoredAt: new Date().toISOString(),
    };
  }

  /** Returns 0–100 consistency score. 100 = perfectly consistent; 0 = extreme variation. */
  private computeConsistencyScore(amounts: number[]): number {
    if (amounts.length === 0) return 0;
    if (amounts.length === 1) return 50; // single data point — neutral

    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    if (mean === 0) return 0;

    const variance =
      amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / amounts.length;
    const stddev = Math.sqrt(variance);
    const cv = stddev / mean; // coefficient of variation

    // cv = 0 → perfectly consistent → 100; cv ≥ 1 → highly variable → 0
    return Math.max(0, Math.round((1 - Math.min(cv, 1)) * 100));
  }
}
