import { RegulatoryReportService } from '../services/RegulatoryReportService';

const BUSINESS_ID = 'biz_abidjan_civ_001';
const PERIOD = { from: '2026-01-01', to: '2026-03-31' };
const FIXED_NOW = '2026-03-07T12:00:00.000Z';

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
    scoredAt: FIXED_NOW,
    sectorBenchmark: {
      averageTrustScore: 62,
      businessCount: 0,
      note: 'Anonymized aggregate data.',
    },
  };
}

let invoiceCounter = 0;
function resetInvoiceCounter() { invoiceCounter = 0; }

function makeInvoice(status: 'paid' | 'sent' | 'overdue' | 'draft', amount: number, id?: string) {
  invoiceCounter += 1;
  return {
    id: id ?? `inv-${String(invoiceCounter).padStart(3, '0')}`,
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

function makeBusiness(overrides: Partial<{ taxRegime: string; countryCode: string; vatRegistered?: boolean }> = {}) {
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
      makeInvoice('paid', 500_000, 'inv-001'),
      makeInvoice('paid', 750_000, 'inv-002'),
      makeInvoice('sent', 250_000, 'inv-003'),
    ],
    unpaidInvoices = [makeInvoice('sent', 250_000, 'inv-003')],
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

  return {
    service: new RegulatoryReportService(
      reportService,
      trustScoreService,
      invoiceService,
      businessRepository,
    ),
    reportService,
    trustScoreService,
    invoiceService,
    businessRepository,
  };
}

describe('RegulatoryReportService', () => {
  beforeEach(() => {
    resetInvoiceCounter();
  });

  describe('generateReport', () => {
    it('returns a report with all required BCEAO fields', async () => {
      const { service } = buildService();
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
      const { service } = buildService({ pl });

      const report = await service.generateReport(BUSINESS_ID, PERIOD);

      expect(report.financialSummary.totalRevenue).toBe(2_000_000);
      expect(report.financialSummary.totalExpenses).toBe(900_000);
      expect(report.financialSummary.netIncome).toBe(1_100_000);
      expect(report.financialSummary.currency).toBe('XOF');
    });

    it('invoicingActivity.totalInvoiced is a number equal to sum of invoice amounts', async () => {
      const invoices = [
        makeInvoice('paid', 300_000, 'inv-001'),
        makeInvoice('paid', 450_000, 'inv-002'),
        makeInvoice('sent', 150_000, 'inv-003'),
      ];
      const { service } = buildService({ invoices, unpaidInvoices: [invoices[2]] });

      const report = await service.generateReport(BUSINESS_ID, PERIOD);

      expect(typeof report.invoicingActivity.totalInvoiced).toBe('number');
      expect(report.invoicingActivity.totalInvoiced).toBe(900_000);
      expect(report.invoicingActivity.paidCount).toBe(2);
      expect(report.invoicingActivity.unpaidCount).toBe(1);
    });

    it('period dates are passed through correctly to the report', async () => {
      const customPeriod = { from: '2025-07-01', to: '2025-09-30' };
      const { service } = buildService();

      const report = await service.generateReport(BUSINESS_ID, customPeriod);

      expect(report.period.from).toBe('2025-07-01');
      expect(report.period.to).toBe('2025-09-30');
    });

    it('handles zero data without throwing', async () => {
      const { service } = buildService({
        pl: makePL({ totalIncome: 0, totalExpenses: 0, netProfit: 0 }),
        trustResult: null,
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
      expect(report.trustScore).toBeNull();
    });

    it('taxCompliance fields reflect business taxRegime and vatRegistered', async () => {
      const business = makeBusiness({ taxRegime: 'flat_tax', countryCode: 'CI' });
      const { service } = buildService({ business });

      const report = await service.generateReport(BUSINESS_ID, PERIOD);

      // Implementation: vatRegistered = taxRegime === 'vat'
      expect(report.taxCompliance.taxRegime).toBe('flat_tax');
      expect(report.taxCompliance.vatRegistered).toBe(false);
      expect(report.taxCompliance.country).toBe('CI');
    });

    it('taxCompliance.vatRegistered is true when taxRegime is vat', async () => {
      const business = makeBusiness({ taxRegime: 'vat', countryCode: 'GH' });
      const { service } = buildService({ business });

      const report = await service.generateReport(BUSINESS_ID, PERIOD);

      expect(report.taxCompliance.taxRegime).toBe('vat');
      expect(report.taxCompliance.vatRegistered).toBe(true);
      expect(report.taxCompliance.country).toBe('GH');
    });

    it('reports negative net income accurately', async () => {
      const pl = makePL({ totalIncome: 500_000, totalExpenses: 800_000, netProfit: -300_000 });
      const { service } = buildService({ pl });

      const report = await service.generateReport(BUSINESS_ID, PERIOD);

      expect(report.financialSummary.netIncome).toBe(-300_000);
      expect(report.financialSummary.totalRevenue).toBe(500_000);
      expect(report.financialSummary.totalExpenses).toBe(800_000);
    });

    it('period validation — from date and to date match input exactly', async () => {
      const { service } = buildService();

      const report = await service.generateReport(BUSINESS_ID, PERIOD);

      expect(report.period.from).toBe('2026-01-01');
      expect(report.period.to).toBe('2026-03-31');
    });

    it('handles missing business gracefully — taxCompliance fields are undefined', async () => {
      const { service } = buildService({ business: null });

      const report = await service.generateReport(BUSINESS_ID, PERIOD);

      // Implementation: taxRegime = business?.taxRegime → undefined when business is null
      // vatRegistered = taxRegime === 'vat' → false (undefined === 'vat' is false)
      expect(report.taxCompliance.vatRegistered).toBe(false);
      expect(report.taxCompliance.taxRegime).toBeUndefined();
      expect(report.taxCompliance.country).toBeUndefined();
    });
  });
});
