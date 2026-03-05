import { Injectable } from '@nestjs/common';
import { ReportService, PLReport } from './ReportService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import type { Business } from '@/domains/ledger/models/Business';

export interface BranchPLReport {
  businessId: string;
  businessName?: string;
  report: PLReport;
}

export interface ConsolidatedPLReport {
  organizationId: string;
  period: { start: string; end: string };
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  currency: string;
  branches: BranchPLReport[];
}

@Injectable()
export class ConsolidatedReportService {
  constructor(
    private readonly reportService: ReportService,
    private readonly businessRepository: BusinessRepository,
  ) {}

  async getConsolidatedPL(
    organizationId: string,
    fromDate: string,
    toDate: string,
  ): Promise<ConsolidatedPLReport> {
    const businesses: Business[] = await this.businessRepository.listByOrganization(organizationId);

    const branchReports: BranchPLReport[] = await Promise.all(
      businesses.map(async (biz) => {
        const report = await this.reportService.getPL(biz.id, fromDate, toDate);
        return { businessId: biz.id, businessName: biz.name, report };
      })
    );

    // Aggregate totals across all branches
    let totalIncome = 0;
    let totalExpenses = 0;
    let currency = 'XOF';

    for (const branch of branchReports) {
      totalIncome += branch.report.totalIncome;
      totalExpenses += branch.report.totalExpenses;
      if (branch.report.currency) {
        currency = branch.report.currency;
      }
    }

    totalIncome = Math.round(totalIncome * 100) / 100;
    totalExpenses = Math.round(totalExpenses * 100) / 100;
    const netProfit = Math.round((totalIncome - totalExpenses) * 100) / 100;

    return {
      organizationId,
      period: { start: fromDate, end: toDate },
      totalIncome,
      totalExpenses,
      netProfit,
      currency,
      branches: branchReports,
    };
  }
}
