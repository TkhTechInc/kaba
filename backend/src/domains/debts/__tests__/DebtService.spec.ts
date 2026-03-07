import { DebtService } from '../services/DebtService';
import { DebtRepository } from '../repositories/DebtRepository';
import { Debt, CreateDebtInput } from '../models/Debt';
import { ListDebtsResult } from '../repositories/DebtRepository';
import { ValidationError, NotFoundError } from '@/shared/errors/DomainError';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { FeatureService } from '@/domains/features/FeatureService';
import { SmsService } from '@/domains/notifications/SmsService';
import { ConfigService } from '@nestjs/config';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'debt-001',
    businessId: 'biz-lagos-001',
    debtorName: 'Kofi Mensah',
    amount: 150000,
    currency: 'XOF',
    dueDate: '2026-04-30',
    status: 'pending',
    phone: '+22961234567',
    notes: 'Livraison de marchandises',
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-03-01T09:00:00.000Z',
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<CreateDebtInput> = {}): CreateDebtInput {
  return {
    businessId: 'biz-lagos-001',
    debtorName: 'Kofi Mensah',
    amount: 150000,
    currency: 'XOF',
    dueDate: '2026-04-30',
    phone: '+22961234567',
    notes: 'Livraison de marchandises',
    ...overrides,
  };
}

const STARTER_BUSINESS = {
  id: 'biz-lagos-001',
  businessId: 'biz-lagos-001',
  tier: 'starter' as const,
  currency: 'XOF',
  phone: '+22961000000',
  name: 'Adeola Trading Co.',
  countryCode: 'BJ',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  onboardingComplete: true,
};

const FREE_BUSINESS = {
  ...STARTER_BUSINESS,
  tier: 'free' as const,
  id: 'biz-free-001',
  businessId: 'biz-free-001',
};

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeMocks(businessTier: 'free' | 'starter' | 'pro' | 'enterprise' = 'starter') {
  const debtRepo = {
    create: jest.fn(),
    getById: jest.fn(),
    listByBusiness: jest.fn(),
    updateStatus: jest.fn(),
    listByBusinessForAging: jest.fn(),
  } as unknown as jest.Mocked<DebtRepository>;

  const businessData = businessTier === 'free' ? FREE_BUSINESS : { ...STARTER_BUSINESS, tier: businessTier };

  const businessRepo = {
    getOrCreate: jest.fn().mockResolvedValue(businessData),
  } as unknown as jest.Mocked<BusinessRepository>;

  const featureService = new FeatureService(null as unknown as ConfigService);

  const smsService = {
    send: jest.fn().mockResolvedValue({ success: true }),
    sendTransactionReceipt: jest.fn().mockResolvedValue({ success: true }),
    formatReceiptMessage: jest.fn().mockReturnValue('SMS reminder'),
  } as unknown as jest.Mocked<SmsService>;

  const service = new DebtService(
    debtRepo,
    businessRepo,
    featureService,
    smsService,
    undefined, // whatsappProvider — optional
    undefined, // auditLogger — optional
  );

  return { service, debtRepo, businessRepo, featureService, smsService };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DebtService', () => {
  describe('create', () => {
    it('creates a debt with correct fields and returns it', async () => {
      const { service, debtRepo } = makeMocks('starter');
      const created = makeDebt();
      (debtRepo.create as jest.Mock).mockResolvedValue(created);

      const result = await service.create(makeCreateInput());

      expect(debtRepo.create).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('debt-001');
      expect(result.businessId).toBe('biz-lagos-001');
      expect(result.debtorName).toBe('Kofi Mensah');
      expect(result.amount).toBe(150000);
      expect(result.currency).toBe('XOF');
      expect(result.dueDate).toBe('2026-04-30');
      expect(result.status).toBe('pending');
    });

    it('passes the full input to the repository', async () => {
      const { service, debtRepo } = makeMocks('starter');
      const created = makeDebt({ phone: '+22997654321', notes: 'Pago à terme' });
      (debtRepo.create as jest.Mock).mockResolvedValue(created);

      const input = makeCreateInput({ phone: '+22997654321', notes: 'Pago à terme' });
      await service.create(input);

      const callArg = (debtRepo.create as jest.Mock).mock.calls[0][0] as CreateDebtInput;
      expect(callArg.phone).toBe('+22997654321');
      expect(callArg.notes).toBe('Pago à terme');
    });

    it('throws ValidationError when debt_tracker feature is disabled (free tier)', async () => {
      const { service } = makeMocks('free');

      await expect(
        service.create(makeCreateInput({ businessId: 'biz-free-001' })),
      ).rejects.toThrow(ValidationError);
    });

    it('creates debt without optional customerId/phone/notes', async () => {
      const { service, debtRepo } = makeMocks('starter');
      const minimal = makeDebt({ customerId: undefined, phone: undefined, notes: undefined });
      (debtRepo.create as jest.Mock).mockResolvedValue(minimal);

      const input = makeCreateInput({ customerId: undefined, phone: undefined, notes: undefined });
      const result = await service.create(input);

      expect(result.id).toBe('debt-001');
      expect(result.phone).toBeUndefined();
    });
  });

  describe('list', () => {
    it('returns debts for a given businessId', async () => {
      const { service, debtRepo } = makeMocks('starter');
      const mockResult: ListDebtsResult = {
        items: [makeDebt(), makeDebt({ id: 'debt-002', debtorName: 'Amina Traoré', amount: 80000 })],
        total: 2,
        page: 1,
        limit: 20,
      };
      (debtRepo.listByBusiness as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.list('biz-lagos-001');

      expect(debtRepo.listByBusiness).toHaveBeenCalledWith(
        'biz-lagos-001', 1, 20, undefined, undefined, undefined, undefined,
      );
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by status when provided', async () => {
      const { service, debtRepo } = makeMocks('starter');
      (debtRepo.listByBusiness as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

      await service.list('biz-lagos-001', 1, 20, 'overdue');

      expect(debtRepo.listByBusiness).toHaveBeenCalledWith(
        'biz-lagos-001', 1, 20, 'overdue', undefined, undefined, undefined,
      );
    });

    it('filters by date range when fromDate and toDate are provided', async () => {
      const { service, debtRepo } = makeMocks('starter');
      (debtRepo.listByBusiness as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

      await service.list('biz-lagos-001', 1, 20, undefined, '2026-03-01', '2026-03-31');

      expect(debtRepo.listByBusiness).toHaveBeenCalledWith(
        'biz-lagos-001', 1, 20, undefined, undefined, '2026-03-01', '2026-03-31',
      );
    });

    it('throws ValidationError for free tier (feature disabled)', async () => {
      const { service } = makeMocks('free');

      await expect(service.list('biz-free-001')).rejects.toThrow(ValidationError);
    });

    it('returns empty list when no debts exist', async () => {
      const { service, debtRepo } = makeMocks('starter');
      (debtRepo.listByBusiness as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

      const result = await service.list('biz-lagos-001');
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getById', () => {
    it('returns a debt when it exists', async () => {
      const { service, debtRepo } = makeMocks('starter');
      const debt = makeDebt();
      (debtRepo.getById as jest.Mock).mockResolvedValue(debt);

      const result = await service.getById('biz-lagos-001', 'debt-001');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('debt-001');
    });

    it('returns null when debt does not exist', async () => {
      const { service, debtRepo } = makeMocks('starter');
      (debtRepo.getById as jest.Mock).mockResolvedValue(null);

      const result = await service.getById('biz-lagos-001', 'debt-missing');
      expect(result).toBeNull();
    });

    it('throws ValidationError for free tier', async () => {
      const { service } = makeMocks('free');
      await expect(service.getById('biz-free-001', 'debt-001')).rejects.toThrow(ValidationError);
    });
  });

  describe('markPaid', () => {
    it('updates debt status to paid and returns updated debt', async () => {
      const { service, debtRepo } = makeMocks('starter');
      const updated = makeDebt({ status: 'paid' });
      (debtRepo.updateStatus as jest.Mock).mockResolvedValue(updated);

      const result = await service.markPaid('biz-lagos-001', 'debt-001');

      expect(debtRepo.updateStatus).toHaveBeenCalledWith('biz-lagos-001', 'debt-001', 'paid');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('paid');
    });

    it('returns null when debt does not exist', async () => {
      const { service, debtRepo } = makeMocks('starter');
      (debtRepo.updateStatus as jest.Mock).mockResolvedValue(null);

      const result = await service.markPaid('biz-lagos-001', 'debt-missing');
      expect(result).toBeNull();
    });

    it('throws ValidationError for free tier', async () => {
      const { service } = makeMocks('free');
      await expect(service.markPaid('biz-free-001', 'debt-001')).rejects.toThrow(ValidationError);
    });
  });

  describe('sendReminder', () => {
    it('throws ValidationError when debt_reminders feature is disabled (starter tier)', async () => {
      const { service, debtRepo } = makeMocks('starter');
      (debtRepo.getById as jest.Mock).mockResolvedValue(makeDebt());

      // starter tier does not have debt_reminders
      await expect(service.sendReminder('biz-lagos-001', 'debt-001')).rejects.toThrow(ValidationError);
    });

    it('sends SMS reminder via SmsService when WhatsApp not configured (pro tier)', async () => {
      const { service, debtRepo, smsService, businessRepo } = makeMocks('pro');
      const proBusinessData = { ...STARTER_BUSINESS, tier: 'pro' as const };
      (businessRepo.getOrCreate as jest.Mock).mockResolvedValue(proBusinessData);

      const debt = makeDebt({ phone: '+22961234567', status: 'pending' });
      (debtRepo.getById as jest.Mock).mockResolvedValue(debt);
      (smsService.send as jest.Mock).mockResolvedValue({ success: true });

      const result = await service.sendReminder('biz-lagos-001', 'debt-001');
      expect(result.sent).toBe(true);
      expect(result.channel).toBe('sms');
      expect(smsService.send).toHaveBeenCalledWith('+22961234567', expect.any(String));
    });

    it('throws NotFoundError when debt does not exist (pro tier)', async () => {
      const { service, debtRepo, businessRepo } = makeMocks('pro');
      const proBusinessData = { ...STARTER_BUSINESS, tier: 'pro' as const };
      (businessRepo.getOrCreate as jest.Mock).mockResolvedValue(proBusinessData);
      (debtRepo.getById as jest.Mock).mockResolvedValue(null);

      await expect(service.sendReminder('biz-lagos-001', 'debt-missing')).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when debtor has no phone number (pro tier)', async () => {
      const { service, debtRepo, businessRepo } = makeMocks('pro');
      const proBusinessData = { ...STARTER_BUSINESS, tier: 'pro' as const };
      (businessRepo.getOrCreate as jest.Mock).mockResolvedValue(proBusinessData);

      const debt = makeDebt({ phone: undefined, status: 'pending' });
      (debtRepo.getById as jest.Mock).mockResolvedValue(debt);

      await expect(service.sendReminder('biz-lagos-001', 'debt-001')).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when debt is already paid (pro tier)', async () => {
      const { service, debtRepo, businessRepo } = makeMocks('pro');
      const proBusinessData = { ...STARTER_BUSINESS, tier: 'pro' as const };
      (businessRepo.getOrCreate as jest.Mock).mockResolvedValue(proBusinessData);

      const debt = makeDebt({ phone: '+22961234567', status: 'paid' });
      (debtRepo.getById as jest.Mock).mockResolvedValue(debt);

      await expect(service.sendReminder('biz-lagos-001', 'debt-001')).rejects.toThrow(ValidationError);
    });
  });

  describe('overdue detection (via repository status logic)', () => {
    // DebtService.create delegates status determination to the repository.
    // It does not compute overdue status itself — it simply passes the input and returns
    // whatever the repo returned. These tests verify that the service surfaces the
    // repo-computed status correctly, and that markPaid can transition any status to paid.

    it('surfaces overdue status returned by repository for a past dueDate', async () => {
      const { service, debtRepo } = makeMocks('starter');
      // The repo is responsible for computing overdue; the service just passes through.
      const overdueDebt = makeDebt({ dueDate: '2025-01-01', status: 'overdue' });
      (debtRepo.create as jest.Mock).mockResolvedValue(overdueDebt);

      const input = makeCreateInput({ dueDate: '2025-01-01' });
      const result = await service.create(input);

      // Service must not flip the status — repo returned 'overdue', service returns 'overdue'
      expect(result.status).toBe('overdue');
      // Verify the service passed the input through unchanged (dueDate is preserved)
      const callArg = (debtRepo.create as jest.Mock).mock.calls[0][0] as CreateDebtInput;
      expect(callArg.dueDate).toBe('2025-01-01');
    });

    it('surfaces pending status returned by repository for a future dueDate', async () => {
      const { service, debtRepo } = makeMocks('starter');
      const pendingDebt = makeDebt({ dueDate: '2027-12-31', status: 'pending' });
      (debtRepo.create as jest.Mock).mockResolvedValue(pendingDebt);

      const input = makeCreateInput({ dueDate: '2027-12-31' });
      const result = await service.create(input);

      expect(result.status).toBe('pending');
      const callArg = (debtRepo.create as jest.Mock).mock.calls[0][0] as CreateDebtInput;
      expect(callArg.dueDate).toBe('2027-12-31');
    });

    it('markPaid transitions an overdue debt to paid', async () => {
      const { service, debtRepo } = makeMocks('starter');
      const paidDebt = makeDebt({ dueDate: '2025-01-01', status: 'paid' });
      (debtRepo.updateStatus as jest.Mock).mockResolvedValue(paidDebt);

      const result = await service.markPaid('biz-lagos-001', 'debt-001');
      expect(debtRepo.updateStatus).toHaveBeenCalledWith('biz-lagos-001', 'debt-001', 'paid');
      expect(result!.status).toBe('paid');
    });
  });
});
