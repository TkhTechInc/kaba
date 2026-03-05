import { Injectable } from '@nestjs/common';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';
import { Debt } from '@/domains/debts/models/Debt';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { ValidationError } from '@/shared/errors/DomainError';

export interface AgingBucket {
  label: string;
  daysMin: number;
  daysMax: number;
  amount: number;
  count: number;
  debts: Debt[];
}

export interface AgingDebtReport {
  asOfDate: string;
  currency: string;
  buckets: AgingBucket[];
  totalAmount: number;
  totalCount: number;
}

export interface PLReport {
  period: { start: string; end: string };
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  currency: string;
  byCategory: Array<{ category: string; amount: number; type: 'sale' | 'expense' }>;
}

export interface CashFlowSummary {
  period: { start: string; end: string };
  openingBalance: number;
  totalInflows: number;
  totalOutflows: number;
  closingBalance: number;
  currency: string;
  daily?: Array<{ date: string; inflow: number; outflow: number; balance: number }>;
}

@Injectable()
export class ReportService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly debtRepository: DebtRepository,
    private readonly businessRepository: BusinessRepository,
  ) {}

  async getPL(
    businessId: string,
    fromDate: string,
    toDate: string,
  ): Promise<PLReport> {
    if (!businessId?.trim()) throw new ValidationError('businessId is required');
    const entries = await this.ledgerRepository.listByBusinessAndDateRange(
      businessId,
      fromDate,
      toDate,
    );

    let totalIncome = 0;
    let totalExpenses = 0;
    // Keyed by `${category}:${type}` so that a category name shared across income
    // and expense entries is tracked independently rather than the type being overwritten.
    const byCategory: Record<string, { category: string; amount: number; type: 'sale' | 'expense' }> = {};

    for (const e of entries) {
      const cat = e.category || 'Uncategorized';
      const key = `${cat}:${e.type}`;
      if (!byCategory[key]) byCategory[key] = { category: cat, amount: 0, type: e.type };
      byCategory[key].amount += e.amount;

      if (e.type === 'sale') totalIncome += e.amount;
      else totalExpenses += e.amount;
    }

    const byCategoryArray = Object.values(byCategory).map(({ category, amount, type }) => ({
      category,
      amount,
      type,
    }));

    const business = await this.businessRepository.getById(businessId);
    const currency = entries[0]?.currency ?? business?.currency ?? 'NGN';

    return {
      period: { start: fromDate, end: toDate },
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      currency,
      byCategory: byCategoryArray,
    };
  }

  async getCashFlow(
    businessId: string,
    fromDate: string,
    toDate: string,
  ): Promise<CashFlowSummary> {
    if (!businessId?.trim()) throw new ValidationError('businessId is required');
    const entries = await this.ledgerRepository.listByBusinessAndDateRange(
      businessId,
      fromDate,
      toDate,
    );

    const allEntries = await this.ledgerRepository.listAllByBusinessForBalance(businessId);
    const beforePeriod = allEntries.filter((e) => e.date < fromDate);
    let openingBalance = 0;
    for (const e of beforePeriod) {
      openingBalance += e.type === 'sale' ? e.amount : -e.amount;
    }

    let totalInflows = 0;
    let totalOutflows = 0;
    const dailyMap: Record<string, { inflow: number; outflow: number }> = {};

    for (const e of entries) {
      if (e.type === 'sale') {
        totalInflows += e.amount;
        if (!dailyMap[e.date]) dailyMap[e.date] = { inflow: 0, outflow: 0 };
        dailyMap[e.date].inflow += e.amount;
      } else {
        totalOutflows += e.amount;
        if (!dailyMap[e.date]) dailyMap[e.date] = { inflow: 0, outflow: 0 };
        dailyMap[e.date].outflow += e.amount;
      }
    }

    const sortedDates = Object.keys(dailyMap).sort();
    let runningBalance = openingBalance;
    const daily = sortedDates.map((date) => {
      const { inflow, outflow } = dailyMap[date];
      runningBalance += inflow - outflow;
      return { date, inflow, outflow, balance: runningBalance };
    });

    const closingBalance = openingBalance + totalInflows - totalOutflows;

    const business = await this.businessRepository.getById(businessId);
    const currency = entries[0]?.currency ?? business?.currency ?? 'NGN';

    return {
      period: { start: fromDate, end: toDate },
      openingBalance,
      totalInflows,
      totalOutflows,
      closingBalance,
      currency,
      daily: daily.length ? daily : undefined,
    };
  }

  /**
   * Aging debt report: groups unpaid debts by how many days overdue.
   * Buckets: Current (not yet due), 0-30, 31-60, 61-90, 90+ days overdue.
   */
  async getAgingDebt(
    businessId: string,
    asOfDate?: string,
  ): Promise<AgingDebtReport> {
    if (!businessId?.trim()) throw new ValidationError('businessId is required');

    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    asOf.setHours(0, 0, 0, 0);
    const asOfStr = asOf.toISOString().slice(0, 10);

    const debts = await this.debtRepository.listByBusinessForAging(businessId);
    const business = await this.businessRepository.getById(businessId);
    const currency = debts[0]?.currency ?? business?.currency ?? 'NGN';

    const bucketDefs: Array<{ label: string; daysMin: number; daysMax: number }> = [
      { label: 'Current (not yet due)', daysMin: -999999, daysMax: -1 },
      { label: '0-30 days', daysMin: 0, daysMax: 30 },
      { label: '31-60 days', daysMin: 31, daysMax: 60 },
      { label: '61-90 days', daysMin: 61, daysMax: 90 },
      { label: '90+ days', daysMin: 91, daysMax: 999999 },
    ];

    const buckets: AgingBucket[] = bucketDefs.map((def) => ({
      ...def,
      amount: 0,
      count: 0,
      debts: [] as Debt[],
    }));

    for (const debt of debts) {
      const due = new Date(debt.dueDate);
      due.setHours(0, 0, 0, 0);
      const daysOverdue = Math.floor((asOf.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));

      const bucket = buckets.find(
        (b) => daysOverdue >= b.daysMin && daysOverdue <= b.daysMax,
      );
      if (bucket) {
        bucket.amount += debt.amount;
        bucket.count += 1;
        bucket.debts.push(debt);
      }
    }

    const totalAmount = buckets.reduce((sum, b) => sum + b.amount, 0);
    const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);

    return {
      asOfDate: asOfStr,
      currency,
      buckets,
      totalAmount,
      totalCount,
    };
  }
}
