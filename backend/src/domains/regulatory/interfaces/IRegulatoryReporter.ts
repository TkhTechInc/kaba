export interface RegulatoryReportPeriod {
  from: string; // ISO date YYYY-MM-DD
  to: string;
}

export interface RegulatoryReport {
  businessId: string;
  period: RegulatoryReportPeriod;
  reportedAt: string;
  schemaVersion: '1.0';
  financialSummary: {
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    currency: string;
  };
  trustScore: {
    score: number;
    recommendation: string;
    scoredAt: string;
  } | null;
  invoicingActivity: {
    totalInvoiced: number;
    paidCount: number;
    unpaidCount: number;
  };
  taxCompliance: {
    vatRegistered: boolean;
    taxRegime: string | undefined;
    country: string | undefined;
  };
  sectorBenchmark?: {
    averageTrustScore: number;
    businessCount: number;
    note: string;
  };
}

export interface IRegulatoryReporter {
  generateReport(businessId: string, period: RegulatoryReportPeriod): Promise<RegulatoryReport>;
}
