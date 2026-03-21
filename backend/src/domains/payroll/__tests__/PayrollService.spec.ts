import { PayrollService } from '../services/PayrollService';
import { EmployeeRepository } from '../repositories/EmployeeRepository';
import { PayRunRepository } from '../repositories/PayRunRepository';
import { PayRunLineRepository } from '../repositories/PayRunLineRepository';
import { PayrollTaxEngineManager } from '../providers/PayrollTaxEngineManager';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { LedgerService } from '@/domains/ledger/services/LedgerService';
import { PaymentsClient } from '@/domains/payments/services/PaymentsClient';
import { NotFoundError, ValidationError } from '@/shared/errors/DomainError';
import type { Employee } from '../models/Employee';
import type { PayRun } from '../models/PayRun';
import type { PayRunLine } from '../models/PayRunLine';

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'emp-1',
  businessId: 'biz-1',
  name: 'Test',
  grossSalary: 100_000,
  currency: 'XOF',
  countryCode: 'BJ',
  status: 'active',
  momoPhone: '+22961234567',
  employmentStartDate: '2024-01-01',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...overrides,
});

const makePayRun = (overrides: Partial<PayRun> = {}): PayRun => ({
  id: 'pr-1',
  businessId: 'biz-1',
  periodMonth: '2024-01',
  status: 'finalized',
  totalGross: 100_000,
  totalNet: 90_000,
  totalEmployerContributions: 15_000,
  totalEmployeeDeductions: 10_000,
  totalIncomeTax: 5_000,
  currency: 'XOF',
  createdAt: '2024-01-01',
  ...overrides,
});

const makePayRunLine = (overrides: Partial<PayRunLine> = {}): PayRunLine => ({
  id: 'line-1',
  payRunId: 'pr-1',
  businessId: 'biz-1',
  employeeId: 'emp-1',
  grossSalary: 100_000,
  employeeContributions: 3_600,
  employerContributions: 15_400,
  incomeTax: 5_000,
  deductionsBreakdown: [],
  netPay: 91_400,
  paymentStatus: 'pending',
  createdAt: '2024-01-01',
  ...overrides,
});

function makeMocks() {
  const employeeRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    listByBusiness: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<EmployeeRepository>;

  const payRunRepo = {
    create: jest.fn(),
    createWithLines: jest.fn(),
    findById: jest.fn(),
    findByPeriod: jest.fn(),
    update: jest.fn(),
    listByBusiness: jest.fn(),
  } as unknown as jest.Mocked<PayRunRepository>;

  const payRunLineRepo = {
    create: jest.fn(),
    listByPayRun: jest.fn(),
    buildDynamoItem: jest.fn((line: PayRunLine) => ({ pk: line.businessId, sk: `LINE#${line.payRunId}#${line.employeeId}` })),
    updatePaymentStatus: jest.fn(),
  } as unknown as jest.Mocked<PayRunLineRepository>;

  const businessRepo = {
    getById: jest.fn().mockResolvedValue({ id: 'biz-1', currency: 'XOF', countryCode: 'BJ' }),
  } as unknown as jest.Mocked<BusinessRepository>;

  const ledgerService = {
    createEntry: jest.fn().mockResolvedValue({ id: 'le-1' }),
  } as unknown as jest.Mocked<LedgerService>;

  const paymentsClient = {
    disburse: jest.fn().mockResolvedValue({ success: true }),
  } as unknown as jest.Mocked<PaymentsClient>;

  const service = new PayrollService(
    employeeRepo,
    payRunRepo,
    payRunLineRepo,
    new PayrollTaxEngineManager(),
    businessRepo,
    ledgerService,
    paymentsClient,
    undefined,
  );

  return {
    service,
    employeeRepo,
    payRunRepo,
    payRunLineRepo,
    businessRepo,
    ledgerService,
    paymentsClient,
  };
}

describe('PayrollService', () => {
  describe('createPayRun', () => {
    it('creates pay run with lines atomically via createWithLines', async () => {
      const mocks = makeMocks();
      const employees = [makeEmployee({ id: 'emp-1' }), makeEmployee({ id: 'emp-2', grossSalary: 50_000 })];
      mocks.employeeRepo.listByBusiness.mockResolvedValue(employees);
      mocks.payRunRepo.findByPeriod.mockResolvedValue(null);
      mocks.payRunRepo.createWithLines.mockResolvedValue(undefined);

      const payRun = await mocks.service.createPayRun('biz-1', '2024-01');

      expect(mocks.payRunRepo.createWithLines).toHaveBeenCalledTimes(1);
      const [pr, lineItems] = mocks.payRunRepo.createWithLines.mock.calls[0];
      expect(pr.businessId).toBe('biz-1');
      expect(pr.periodMonth).toBe('2024-01');
      expect(pr.status).toBe('draft');
      expect(lineItems).toHaveLength(2);
      expect(payRun.totalGross).toBe(150_000);
    });

    it('throws if pay run exists for period', async () => {
      const mocks = makeMocks();
      mocks.payRunRepo.findByPeriod.mockResolvedValue(makePayRun());

      await expect(mocks.service.createPayRun('biz-1', '2024-01')).rejects.toThrow(ValidationError);
      expect(mocks.payRunRepo.createWithLines).not.toHaveBeenCalled();
    });

    it('throws if no active employees', async () => {
      const mocks = makeMocks();
      mocks.payRunRepo.findByPeriod.mockResolvedValue(null);
      mocks.employeeRepo.listByBusiness.mockResolvedValue([]);

      await expect(mocks.service.createPayRun('biz-1', '2024-01')).rejects.toThrow(ValidationError);
    });
  });

  describe('payPayRun', () => {
    it('marks pay run paid only when all disbursements succeed', async () => {
      const mocks = makeMocks();
      const payRun = makePayRun({ status: 'finalized' });
      const lines = [makePayRunLine({ employeeId: 'emp-1' })];
      mocks.payRunRepo.findById.mockResolvedValue(payRun);
      mocks.payRunLineRepo.listByPayRun.mockResolvedValue(lines);
      mocks.employeeRepo.findById.mockResolvedValue(makeEmployee({ momoPhone: '+22961234567' }));
      mocks.paymentsClient.disburse.mockResolvedValue({ success: true });

      const result = await mocks.service.payPayRun('biz-1', 'pr-1');

      expect(result.failedLines).toHaveLength(0);
      expect(mocks.payRunRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'paid', paidAt: expect.any(String) }),
      );
    });

    it('returns failedLines when some disbursements fail', async () => {
      const mocks = makeMocks();
      const payRun = makePayRun({ status: 'finalized' });
      const lines = [
        makePayRunLine({ employeeId: 'emp-1' }),
        makePayRunLine({ employeeId: 'emp-2' }),
      ];
      mocks.payRunRepo.findById.mockResolvedValue(payRun);
      mocks.payRunLineRepo.listByPayRun.mockResolvedValue(lines);
      mocks.employeeRepo.findById
        .mockResolvedValueOnce(makeEmployee({ id: 'emp-1', momoPhone: '+22961111111' }))
        .mockResolvedValueOnce(makeEmployee({ id: 'emp-2', momoPhone: '+22962222222' }));
      mocks.paymentsClient.disburse
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'Insufficient balance' });

      const result = await mocks.service.payPayRun('biz-1', 'pr-1');

      expect(result.failedLines).toHaveLength(1);
      expect(result.failedLines[0].employeeId).toBe('emp-2');
      expect(result.failedLines[0].paymentStatus).toBe('failed');
      expect(mocks.payRunRepo.update).not.toHaveBeenCalled();
    });

    it('throws if pay run not found', async () => {
      const mocks = makeMocks();
      mocks.payRunRepo.findById.mockResolvedValue(null);

      await expect(mocks.service.payPayRun('biz-1', 'pr-1')).rejects.toThrow(NotFoundError);
    });

    it('throws if pay run not finalized', async () => {
      const mocks = makeMocks();
      mocks.payRunRepo.findById.mockResolvedValue(makePayRun({ status: 'draft' }));

      await expect(mocks.service.payPayRun('biz-1', 'pr-1')).rejects.toThrow(ValidationError);
    });
  });
});
