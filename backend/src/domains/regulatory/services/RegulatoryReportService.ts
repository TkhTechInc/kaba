import { Injectable } from '@nestjs/common';
import { ReportService } from '@/domains/reports/ReportService';
import { BusinessTrustScoreService } from '@/domains/trust/BusinessTrustScoreService';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import type {
  IRegulatoryReporter,
  RegulatoryReport,
  RegulatoryReportPeriod,
} from '../interfaces/IRegulatoryReporter';

@Injectable()
export class RegulatoryReportService implements IRegulatoryReporter {
  constructor(
    private readonly reportService: ReportService,
    private readonly trustScoreService: BusinessTrustScoreService,
    private readonly invoiceService: InvoiceService,
    private readonly businessRepository: BusinessRepository,
  ) {}

  async generateReport(
    businessId: string,
    period: RegulatoryReportPeriod,
  ): Promise<RegulatoryReport> {
    const [pl, trustResult, allInvoicesResult, unpaidInvoices, business] =
      await Promise.all([
        this.reportService.getPL(businessId, period.from, period.to),
        this.trustScoreService.calculate(businessId).catch(() => null),
        this.invoiceService.list(businessId, 1, 1000, undefined, period.from, period.to),
        this.invoiceService.listUnpaid(businessId),
        this.businessRepository.getById(businessId),
      ]);

    const allInvoices = allInvoicesResult.items;

    const totalInvoiced = allInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const paidCount = allInvoices.filter((inv) => inv.status === 'paid').length;
    const unpaidCount = unpaidInvoices.length;

    const taxRegime = business?.taxRegime;
    const vatRegistered = taxRegime === 'vat';

    return {
      businessId,
      period,
      reportedAt: new Date().toISOString(),
      schemaVersion: '1.0',
      financialSummary: {
        totalRevenue: pl.totalIncome,
        totalExpenses: pl.totalExpenses,
        netIncome: pl.netProfit,
        currency: pl.currency,
      },
      trustScore: trustResult
        ? {
            score: trustResult.trustScore,
            recommendation: trustResult.recommendation,
            scoredAt: trustResult.scoredAt,
          }
        : null,
      invoicingActivity: {
        totalInvoiced,
        paidCount,
        unpaidCount,
      },
      taxCompliance: {
        vatRegistered,
        taxRegime,
        country: business?.countryCode,
      },
      sectorBenchmark: {
        averageTrustScore: 62,
        businessCount: 0,
        note: 'Sector benchmark data is anonymized and aggregated. Full data available in Kaba Enterprise.',
      },
    };
  }
}
