import { RegulatoryReportService } from '../services/RegulatoryReportService';

const BUSINESS_ID = 'biz_abidjan_civ_001';
const PERIOD = { from: '2026-01-01', to: '2026-03-31' };

function makePL(overrides: Partial<{ totalIncome: number; totalExpenses: number; netProfit: number }> = {}) {
  return {
    totalIncome: 1_500_000,
    totalExpenses: 800_000,
    netProfit: 700_000,
    currency: 'XOF',
    ...overrides,
  };
}

function makeTrustResult(score = 72) {
  return {
    businessId: BUSINESS_ID,
    trustScore: score,
    breakdown: {
      repaymentVelocity: 80,
      transactionRecency: 70,
      momoReconciliation: 75,
      customerRetention: 60,
      networkDiversity: 50,
    },
    marketDayAwarenessApplied: false,
    recommendation: 'good' as const,
    scoredAt: new Date().toISOString(),
    sectorBenchmark: {
      averageTrustScore: 62,
      businessCount: 0,
      note: 'Anonymized aggregate data.',
    },
  };
}

function makeInvoice(status: 'paid' | 'sent' | 'overdue' | 'draft', amount: number) {
  return {
    id: `inv-${Math.random().toString(36).slice(2, 8)}`,
    businessId: BUSINESS_ID,
    customerId: 'cust-001',
    amount,
    currency: 'XOF',
    status,
    items: [],
    dueDate: '2026-02-28',
    createdAt: '2026-01-15T10:00:00.000Z',
  };
}

function makeBusiness(overrides: Partial<{ taxRegime: string; countryCode: string }> = {}) {
  return {
    businessId: BUSINESS_ID,
    name: 'Commerce Kouassi',
    countryCode: 'CI',
    currency: 'XOF',
    taxRegime: 'flat_tax',
    ...overrides,
  };
}

function buildService(overrides: {
  pl?: ReturnType<typeof makePL>;
  trustResult?: ReturnType<typeof makeTrustResult> | null;
  invoices?: any[];
  unpaidInvoices?: any[];
  business?: any;
} = {}) {
  const {
    pl = makePL(),
    trustResult = makeTrustResult(),
    invoices = [
      makeInvoice('paid', 500_000),
      makeInvoice('paid', 750_000),
      makeInvoice('sent', 250_000),
    ],
    unpaidInvoices = [makeInvoice('sent', 250_000)],
    business = makeBusiness(),
  } = overrides;

  const reportService = {
    getPL: jest.fn().mockResolvedValue(pl),
  } as any;

  const trustScoreService = {
    calculate: trustResult !== null
      ? jest.fn().mockResolvedValue(trustResult)
      : jest.fn().mockRejectedValue(new Error('No data')),
  } as any;

  const invoiceService = {
    list: jest.fn().mockResolvedValue({ items: invoices, total: invoices.length }),
    listUnpaid: jest.fn().mockResolvedValue(unpaidInvoices),
  } as any;

  const businessRepository = {
    getById: jest.fn().mockResolvedValue(business),
  } as any;

  return new RegulatoryReportService(
    reportService,
    trustScoreService,
    invoiceService,
    businessRepository,
  );
}

describe('RegulatoryReportService', () => {
  describe('generateReport', () => {
    it('returns a report with all required BCEAO fields', async () => {
      const service = buildService();
      const report = await service.generateReport(BUSINESS_ID, PERIOD);

      expect(report).toHaveProperty('businessId', BUSINESS_ID);
      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('reportedAt');
      expect(report).toHaveProperty('schemaVersion', '1.0');
      expect(report).toHaveProperty('financialSummary');
      expect(report.financialSummary).toHaveProperty('totalRevenue');
      expect(report.financialSummary).toHaveProperty('totalExpenses');
      expect(report.financialSummary).toHaveProperty('netIncome');
      expect(report.financialSummary).toHaveProperty('currency');
      expect(report).toHaveProperty('trustScore');
      expect(report).toHaveProperty('invoicingActivity');
      expect(report.invoicingActivity).toHaveProperty('totalInvoiced');
      expect(report.invoicingActivity).toHaveProperty('paidCount');
      expect(report.invoicingActivity).toHaveProperty('unpaidCount');
      expect(report).toHaveProperty('taxCompliance');
      expect(report.taxCompliance).toHaveProperty('vatRegistered');
      expect(report.taxCompliance).toHaveProperty('taxRegime');
      expect(report).toHaveProperty('sectorBenchmark');
    });

    it('financialSummary.revenue equals total income from P&L', async () => {
      const pl = makePL({ totalIncome: 2_000_000, totalExpenses: 900_000, netProfit: 1_100_000 });
      const service = buildService({ pl });

      const report = await service.generateReport(BUSINESS_ID, PERIOD);

      expect(report.financialSummary.totalRevenue).toBe(2_000_000);
      expect(report.financialSummary.totalExpenses).toBe(900_000);
      expect(report.financialSummary.netIncome).toBe(1_100_000);
      expect(report.financialSummary.currency).toBe('XOF');
    });

    it('invoicingActivity.totalInvoiced is a number equal to sum of invoice amounts', async () => {
      const invoices = [
        makeInvoice('paid', 300_000),
        makeInvoice('paid', 450_000),
        makeInvoice('sent', 150_000),
      ];
      const service = buildService({ invoices, unpaidInvoices: [invoices[2]] });

      const report = await service.generateReport(BUSINESS_ID, PERIOD);

      expect(typeof report.invoicingActivity.totalInvoiced).toBe('number');
      expect(report.invoicingActivity.totalInvoiced).toBe(900_000);
      expect(report.invoicingActivity.paidCount).toBe(2);
      expect(report.invoicingActivity.unpaidCount).toBe(1);
    });

    it('period dates are passed through correctly to the report', async () => {
      const customPeriod = { from: '2025-07-01', to: '2025-09-30' };
      const service = buildService();

      const report = await service.generateReport(BUSINESS_ID, customPeriod);

      expect(report.period.from).toBe('2025-07-01');
      expect(report.period.to).toBe('2025-09-30');
    });

    it('handles zero data without throwing', async () => {
      const service = buildService({
        pl: makePL({ totalIncome: 0, totalExpenses: 0, netProfit: 0 }),
        trustResult: null, // trust calculation throws, should be caught
        invoices: [],
        unpaidInvoices: [],
        business: makeBusiness(),
      });

      const report = await service.generateReport(BUSINESS_ID, PERIOD);

      expect(report).toBeDefined();
      expect(report.financialSummary.totalRevenue).toBe(0);
      expect(report.invoicingActivity.totalInvoiced).toBe(0);
      expect(report.invoicingActivity.paidCount).toBe(0);
      expect(report.invoicingActivity.unpaidCount).toBe(0);
      // trustScore should be null when calculation fails
      expect(report.trustScore).toBeNull();
    });
  });
});
