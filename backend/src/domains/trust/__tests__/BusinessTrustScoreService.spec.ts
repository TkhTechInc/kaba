import { BusinessTrustScoreService } from '../BusinessTrustScoreService';

const BUSINESS_ID = 'biz_dakar_001';

function makeNow() {
  return new Date('2026-03-07T12:00:00.000Z');
}

// Build ISO strings relative to the fixed "now"
function daysAgo(n: number): string {
  const d = new Date(makeNow());
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function makeLedgerEntry(overrides: Partial<{ date: string; type: string }> = {}) {
  return {
    id: 'entry-001',
    businessId: BUSINESS_ID,
    type: 'sale',
    amount: 50_000,
    currency: 'XOF',
    description: 'Vente de tissu',
    category: 'sales',
    date: daysAgo(5),
    createdAt: daysAgo(5),
    ...overrides,
  };
}

function makeDebt(status: 'paid' | 'pending' | 'overdue', paidEarly = true) {
  const dueDate = daysAgo(10);
  // paidEarly: paid 3 days before due; paidLate: paid 5 days after due
  const updatedAt = paidEarly ? daysAgo(13) : daysAgo(5);
  return {
    id: 'debt-001',
    businessId: BUSINESS_ID,
    debtorName: 'Fatou Diallo',
    amount: 100_000,
    currency: 'XOF',
    dueDate,
    status,
    createdAt: daysAgo(30),
    updatedAt,
  };
}

function buildService(overrides: {
  ledgerEntries?: any[];
  debts?: any[];
  invoices?: any[];
  customers?: any[];
  business?: any;
  momoRate?: number;
}) {
  const {
    ledgerEntries = [],
    debts = [],
    invoices = [],
    customers = [],
    business = { businessId: BUSINESS_ID, marketDayCycle: null },
    momoRate = 0.5,
  } = overrides;

  const ledgerRepository = {
    listByBusinessAndDateRange: jest.fn().mockResolvedValue(ledgerEntries),
  } as any;

  const debtRepository = {
    listByBusiness: jest.fn().mockResolvedValue({ items: debts, nextPage: null }),
  } as any;

  const invoiceRepository = {
    listByBusiness: jest.fn().mockResolvedValue({ items: invoices, nextPage: null }),
    listAllByBusiness: jest.fn().mockResolvedValue(invoices),
  } as any;

  const customerRepository = {
    listAllByBusiness: jest.fn().mockResolvedValue(customers),
  } as any;

  const momoReconciliationService = {
    getAverageReconRate: jest.fn().mockResolvedValue(momoRate),
  } as any;

  const businessRepository = {
    getById: jest.fn().mockResolvedValue(business),
    updateTrustScore: jest.fn().mockResolvedValue(undefined),
  } as any;

  return new BusinessTrustScoreService(
    ledgerRepository,
    debtRepository,
    invoiceRepository,
    customerRepository,
    momoReconciliationService,
    businessRepository,
  );
}

describe('BusinessTrustScoreService', () => {
  describe('calculate', () => {
    it('returns a score between 0 and 100', async () => {
      const service = buildService({
        ledgerEntries: [makeLedgerEntry()],
        debts: [makeDebt('paid')],
        customers: [{ id: 'cust-001' }, { id: 'cust-002' }],
        momoRate: 0.8,
      });

      const result = await service.calculate(BUSINESS_ID);

      expect(result.trustScore).toBeGreaterThanOrEqual(0);
      expect(result.trustScore).toBeLessThanOrEqual(100);
    });

    it('business with many recent sales scores higher transaction recency than one with no sales', async () => {
      // Active business: several recent entries (within 45 days)
      const activeEntries = Array.from({ length: 10 }, (_, i) =>
        makeLedgerEntry({ date: daysAgo(i + 1) }),
      );
      const activeService = buildService({ ledgerEntries: activeEntries });

      // Inactive business: no ledger entries
      const inactiveService = buildService({ ledgerEntries: [] });

      const [activeResult, inactiveResult] = await Promise.all([
        activeService.calculate(BUSINESS_ID),
        inactiveService.calculate(BUSINESS_ID),
      ]);

      expect(activeResult.breakdown.transactionRecency).toBeGreaterThan(
        inactiveResult.breakdown.transactionRecency,
      );
    });

    it('business with fully paid debts scores higher repayment velocity than one with no paid debts', async () => {
      // Paid early: dueDate is daysAgo(10), paid at daysAgo(13) → 3 days early
      const paidEarlyDebt = makeDebt('paid', true);
      const serviceWithPaid = buildService({ debts: [paidEarlyDebt] });

      // No paid debts → defaults to score 50
      const serviceNoPaid = buildService({ debts: [makeDebt('pending')] });

      const [withPaidResult, noPaidResult] = await Promise.all([
        serviceWithPaid.calculate(BUSINESS_ID),
        serviceNoPaid.calculate(BUSINESS_ID),
      ]);

      // Paid 3 days early → score > 70; no paid debts → defaults to 50
      expect(withPaidResult.breakdown.repaymentVelocity).toBeGreaterThan(
        noPaidResult.breakdown.repaymentVelocity,
      );
    });

    it('result includes all expected fields', async () => {
      const service = buildService({
        ledgerEntries: [makeLedgerEntry()],
        debts: [makeDebt('paid')],
        invoices: [
          {
            id: 'inv-001',
            businessId: BUSINESS_ID,
            customerId: 'cust-001',
            amount: 75_000,
            currency: 'XOF',
            status: 'paid',
            items: [],
            dueDate: daysAgo(5),
            createdAt: daysAgo(20),
          },
        ],
        customers: [{ id: 'cust-001' }],
        momoRate: 0.9,
      });

      const result = await service.calculate(BUSINESS_ID);

      expect(result).toHaveProperty('businessId', BUSINESS_ID);
      expect(result).toHaveProperty('trustScore');
      expect(result).toHaveProperty('breakdown');
      expect(result.breakdown).toHaveProperty('repaymentVelocity');
      expect(result.breakdown).toHaveProperty('transactionRecency');
      expect(result.breakdown).toHaveProperty('momoReconciliation');
      expect(result.breakdown).toHaveProperty('customerRetention');
      expect(result.breakdown).toHaveProperty('networkDiversity');
      expect(result).toHaveProperty('recommendation');
      expect(result).toHaveProperty('scoredAt');
      expect(result).toHaveProperty('sectorBenchmark');
    });

    it('handles empty data (no entries, no debts) without throwing', async () => {
      const service = buildService({
        ledgerEntries: [],
        debts: [],
        invoices: [],
        customers: [],
        momoRate: 0.5,
      });

      await expect(service.calculate(BUSINESS_ID)).resolves.toBeDefined();
    });

    it('sectorBenchmark is present in result', async () => {
      const service = buildService({});

      const result = await service.calculate(BUSINESS_ID);

      expect(result.sectorBenchmark).toBeDefined();
      expect(result.sectorBenchmark).toHaveProperty('averageTrustScore');
      expect(result.sectorBenchmark).toHaveProperty('businessCount');
      expect(result.sectorBenchmark).toHaveProperty('note');
      expect(typeof result.sectorBenchmark!.averageTrustScore).toBe('number');
    });
  });
});
