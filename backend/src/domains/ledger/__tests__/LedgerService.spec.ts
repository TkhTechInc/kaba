import { LedgerService } from '../services/LedgerService';
import { LedgerRepository } from '../repositories/LedgerRepository';
import { LedgerEntry, CreateLedgerEntryInput } from '../models/LedgerEntry';
import { ValidationError, NotFoundError } from '@/shared/errors/DomainError';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { FeatureService } from '@/domains/features/FeatureService';
import { SmsService } from '@/domains/notifications/SmsService';
import { WebhookService } from '@/domains/webhooks/WebhookService';
import { ProductRepository } from '@/domains/inventory/repositories/ProductRepository';
import { ConfigService } from '@nestjs/config';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLedgerEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: 'entry-001',
    businessId: 'biz-cotonou-001',
    type: 'sale',
    amount: 25000,
    currency: 'XOF',
    description: 'Vente de tissu wax',
    category: 'Ventes',
    date: '2026-03-05',
    createdAt: '2026-03-05T10:00:00.000Z',
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<CreateLedgerEntryInput> = {}): CreateLedgerEntryInput {
  return {
    businessId: 'biz-cotonou-001',
    type: 'sale',
    amount: 25000,
    currency: 'XOF',
    description: 'Vente de tissu wax',
    category: 'Ventes',
    date: '2026-03-05',
    ...overrides,
  };
}

// A "free" business with no phone (to skip SMS side-effects)
const FREE_BUSINESS = {
  id: 'biz-cotonou-001',
  businessId: 'biz-cotonou-001',
  tier: 'free' as const,
  currency: 'XOF',
  phone: undefined,
  name: 'Marché Dantokpa SARL',
  countryCode: 'BJ',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  onboardingComplete: true,
};

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeMocks() {
  const ledgerRepository = {
    create: jest.fn(),
    getById: jest.fn(),
    listByBusiness: jest.fn(),
    listByBusinessAndDateRange: jest.fn(),
    listAllByBusinessForBalance: jest.fn(),
    countByBusiness: jest.fn(),
    countByBusinessInDateRange: jest.fn(),
    getRunningBalance: jest.fn(),
    softDelete: jest.fn(),
    updateRunningBalance: jest.fn(),
  } as unknown as jest.Mocked<LedgerRepository>;

  const productRepository = {
    getById: jest.fn(),
    decrementStock: jest.fn(),
  } as unknown as jest.Mocked<ProductRepository>;

  const businessRepo = {
    getOrCreate: jest.fn().mockResolvedValue(FREE_BUSINESS),
    getLockedPeriods: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<BusinessRepository>;

  const featureService = new FeatureService(null as unknown as ConfigService);

  const smsService = {
    send: jest.fn().mockResolvedValue({ success: true }),
    sendTransactionReceipt: jest.fn().mockResolvedValue({ success: true }),
    formatReceiptMessage: jest.fn().mockReturnValue('SMS message'),
  } as unknown as jest.Mocked<SmsService>;

  const webhookService = {
    emit: jest.fn(),
  } as unknown as jest.Mocked<WebhookService>;

  const eventBridge = {
    send: jest.fn().mockResolvedValue({}),
  };

  const service = new LedgerService(
    ledgerRepository,
    productRepository,
    smsService,
    featureService,
    businessRepo,
    webhookService,
    eventBridge as never,
    undefined, // auditLogger — optional
    undefined, // categorySuggester — optional
  );

  return { service, ledgerRepository, productRepository, businessRepo, featureService, smsService, webhookService, eventBridge };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LedgerService', () => {
  describe('createEntry', () => {
    it('happy path: creates entry and returns it with an id', async () => {
      const { service, ledgerRepository, ledgerRepository: { countByBusinessInDateRange, create } } = makeMocks();
      const created = makeLedgerEntry();

      (countByBusinessInDateRange as jest.Mock).mockResolvedValue(0);
      (create as jest.Mock).mockResolvedValue(created);

      const result = await service.createEntry(makeCreateInput());

      expect(create).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('entry-001');
      expect(result.businessId).toBe('biz-cotonou-001');
      expect(result.amount).toBe(25000);
      expect(result.currency).toBe('XOF');
      expect(result.type).toBe('sale');
    });

    it('passes correct fields to repository.create', async () => {
      const { service, ledgerRepository } = makeMocks();
      const created = makeLedgerEntry();

      (ledgerRepository.countByBusinessInDateRange as jest.Mock).mockResolvedValue(5);
      (ledgerRepository.create as jest.Mock).mockResolvedValue(created);

      const input = makeCreateInput({ description: 'Vente pagne', category: 'Ventes', date: '2026-03-01' });
      await service.createEntry(input);

      const callArg = (ledgerRepository.create as jest.Mock).mock.calls[0][0] as CreateLedgerEntryInput;
      expect(callArg.businessId).toBe('biz-cotonou-001');
      expect(callArg.type).toBe('sale');
      expect(callArg.amount).toBe(25000);
      expect(callArg.currency).toBe('XOF');
      expect(callArg.date).toBe('2026-03-01');
    });

    it('throws ValidationError when businessId is missing', async () => {
      const { service } = makeMocks();
      await expect(
        service.createEntry(makeCreateInput({ businessId: '' })),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when businessId is whitespace', async () => {
      const { service } = makeMocks();
      await expect(
        service.createEntry(makeCreateInput({ businessId: '   ' })),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when type is invalid', async () => {
      const { service } = makeMocks();
      await expect(
        service.createEntry(makeCreateInput({ type: 'transfer' as 'sale' })),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when currency is missing', async () => {
      const { service } = makeMocks();
      await expect(
        service.createEntry(makeCreateInput({ currency: '' })),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when date is missing', async () => {
      const { service } = makeMocks();
      await expect(
        service.createEntry(makeCreateInput({ date: '' })),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when amount is NaN and no productId', async () => {
      const { service } = makeMocks();
      await expect(
        service.createEntry(makeCreateInput({ amount: NaN })),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when ledger limit is reached for free tier', async () => {
      const { service, ledgerRepository } = makeMocks();

      (ledgerRepository.countByBusinessInDateRange as jest.Mock).mockResolvedValue(50);

      await expect(
        service.createEntry(makeCreateInput()),
      ).rejects.toThrow(ValidationError);
    });

    it('skips limit check when skipLimitCheck is true', async () => {
      const { service, ledgerRepository } = makeMocks();
      const created = makeLedgerEntry();

      (ledgerRepository.create as jest.Mock).mockResolvedValue(created);
      // countByBusinessInDateRange should NOT be called
      (ledgerRepository.countByBusinessInDateRange as jest.Mock).mockResolvedValue(999);

      const result = await service.createEntry(makeCreateInput({ skipLimitCheck: true }));
      expect(ledgerRepository.countByBusinessInDateRange).not.toHaveBeenCalled();
      expect(result.id).toBe('entry-001');
    });

    it('throws ValidationError for productId+quantitySold on an expense entry', async () => {
      const { service } = makeMocks();
      await expect(
        service.createEntry(makeCreateInput({ type: 'expense', productId: 'prod-001', quantitySold: 2 })),
      ).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError when referenced product does not exist', async () => {
      const { service, productRepository } = makeMocks();
      (productRepository.getById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createEntry(makeCreateInput({ type: 'sale', productId: 'prod-missing', quantitySold: 1 })),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when stock is insufficient', async () => {
      const { service, productRepository } = makeMocks();
      (productRepository.getById as jest.Mock).mockResolvedValue({
        id: 'prod-001',
        businessId: 'biz-cotonou-001',
        name: 'Tissu Wax',
        unitPrice: 5000,
        quantityInStock: 1,
      });

      await expect(
        service.createEntry(makeCreateInput({ type: 'sale', productId: 'prod-001', quantitySold: 5 })),
      ).rejects.toThrow(ValidationError);
    });

    it('emits webhook on successful create', async () => {
      const { service, ledgerRepository, webhookService } = makeMocks();
      const created = makeLedgerEntry();

      (ledgerRepository.countByBusinessInDateRange as jest.Mock).mockResolvedValue(0);
      (ledgerRepository.create as jest.Mock).mockResolvedValue(created);

      await service.createEntry(makeCreateInput());

      expect(webhookService.emit).toHaveBeenCalledWith(
        'biz-cotonou-001',
        'ledger.entry.created',
        expect.objectContaining({ entryId: 'entry-001', type: 'sale' }),
      );
    });
  });

  describe('getBalance', () => {
    it('returns running balance when counter is initialised', async () => {
      const { service, ledgerRepository, businessRepo } = makeMocks();

      (businessRepo.getOrCreate as jest.Mock).mockResolvedValue({ ...FREE_BUSINESS, currency: 'XOF' });
      (ledgerRepository.getRunningBalance as jest.Mock).mockResolvedValue({ balance: 75000, currency: 'XOF' });

      const result = await service.getBalance('biz-cotonou-001');

      expect(result.balance).toBe(75000);
      expect(result.currency).toBe('XOF');
      expect(result.businessId).toBe('biz-cotonou-001');
      // The fallback (listAllByBusinessForBalance) should NOT have been called
      expect(ledgerRepository.listAllByBusinessForBalance).not.toHaveBeenCalled();
    });

    it('falls back to scanning entries when no running balance exists', async () => {
      const { service, ledgerRepository } = makeMocks();

      (ledgerRepository.getRunningBalance as jest.Mock).mockResolvedValue(null);
      (ledgerRepository.listAllByBusinessForBalance as jest.Mock).mockResolvedValue([
        { type: 'sale', amount: 50000, date: '2026-03-01', category: 'Ventes', currency: 'XOF' },
        { type: 'sale', amount: 30000, date: '2026-03-02', category: 'Ventes', currency: 'XOF' },
        { type: 'expense', amount: 10000, date: '2026-03-03', category: 'Charges', currency: 'XOF' },
      ]);

      const result = await service.getBalance('biz-cotonou-001');
      // 50000 + 30000 - 10000 = 70000
      expect(result.balance).toBe(70000);
      expect(result.currency).toBe('XOF');
    });

    it('returns 0 balance when no entries exist', async () => {
      const { service, ledgerRepository } = makeMocks();

      (ledgerRepository.getRunningBalance as jest.Mock).mockResolvedValue(null);
      (ledgerRepository.listAllByBusinessForBalance as jest.Mock).mockResolvedValue([]);

      const result = await service.getBalance('biz-cotonou-001');
      expect(result.balance).toBe(0);
    });

    it('correctly subtracts expenses from sales', async () => {
      const { service, ledgerRepository } = makeMocks();

      (ledgerRepository.getRunningBalance as jest.Mock).mockResolvedValue(null);
      (ledgerRepository.listAllByBusinessForBalance as jest.Mock).mockResolvedValue([
        { type: 'sale', amount: 100000, date: '2026-01-10', category: 'Ventes', currency: 'XOF' },
        { type: 'expense', amount: 45000, date: '2026-01-15', category: 'Loyer', currency: 'XOF' },
        { type: 'expense', amount: 20000, date: '2026-01-20', category: 'Transport', currency: 'XOF' },
      ]);

      const result = await service.getBalance('biz-cotonou-001');
      // 100000 - 45000 - 20000 = 35000
      expect(result.balance).toBe(35000);
    });

    it('throws ValidationError when businessId is empty', async () => {
      const { service } = makeMocks();
      await expect(service.getBalance('')).rejects.toThrow(ValidationError);
    });
  });

  describe('listEntries', () => {
    it('delegates to repository.listByBusiness with correct args', async () => {
      const { service, ledgerRepository } = makeMocks();
      const mockResult = { items: [], total: 0, page: 1, limit: 20 };
      (ledgerRepository.listByBusiness as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.listEntries('biz-cotonou-001', 1, 20, undefined, 'sale');

      expect(ledgerRepository.listByBusiness).toHaveBeenCalledWith(
        'biz-cotonou-001', 1, 20, undefined, 'sale', undefined, undefined,
      );
      expect(result).toBe(mockResult);
    });

    it('filters by date range when fromDate and toDate are provided', async () => {
      const { service, ledgerRepository } = makeMocks();
      const items = [makeLedgerEntry({ date: '2026-02-10' }), makeLedgerEntry({ date: '2026-02-20' })];
      (ledgerRepository.listByBusiness as jest.Mock).mockResolvedValue({ items, total: 2, page: 1, limit: 20 });

      const result = await service.listEntries(
        'biz-cotonou-001', 1, 20, undefined, undefined, '2026-02-01', '2026-02-28',
      );

      expect(ledgerRepository.listByBusiness).toHaveBeenCalledWith(
        'biz-cotonou-001', 1, 20, undefined, undefined, '2026-02-01', '2026-02-28',
      );
      expect(result.items).toHaveLength(2);
    });

    it('throws ValidationError when businessId is empty', async () => {
      const { service } = makeMocks();
      await expect(service.listEntries('')).rejects.toThrow(ValidationError);
    });
  });

  describe('countEntries', () => {
    it('returns count from repository', async () => {
      const { service, ledgerRepository } = makeMocks();
      (ledgerRepository.countByBusiness as jest.Mock).mockResolvedValue(42);

      const count = await service.countEntries('biz-cotonou-001');
      expect(count).toBe(42);
    });

    it('returns 0 when businessId is empty without throwing', async () => {
      const { service } = makeMocks();
      const count = await service.countEntries('');
      expect(count).toBe(0);
    });
  });

  describe('softDeleteEntry', () => {
    it('soft-deletes an existing entry successfully', async () => {
      const { service, ledgerRepository, businessRepo } = makeMocks();
      const entry = makeLedgerEntry({ deletedAt: undefined });

      (ledgerRepository.getById as jest.Mock).mockResolvedValue(entry);
      (businessRepo.getLockedPeriods as jest.Mock).mockResolvedValue([]);
      (ledgerRepository.softDelete as jest.Mock).mockResolvedValue(true);

      await expect(
        service.softDeleteEntry('biz-cotonou-001', 'entry-001'),
      ).resolves.toBeUndefined();

      expect(ledgerRepository.softDelete).toHaveBeenCalledWith('biz-cotonou-001', 'entry-001');
    });

    it('throws NotFoundError when entry does not exist', async () => {
      const { service, ledgerRepository } = makeMocks();
      (ledgerRepository.getById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.softDeleteEntry('biz-cotonou-001', 'entry-missing'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when entry is already deleted', async () => {
      const { service, ledgerRepository } = makeMocks();
      (ledgerRepository.getById as jest.Mock).mockResolvedValue(
        makeLedgerEntry({ deletedAt: '2026-03-01T00:00:00.000Z' }),
      );

      await expect(
        service.softDeleteEntry('biz-cotonou-001', 'entry-001'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when period is locked (OHADA compliance)', async () => {
      const { service, ledgerRepository, businessRepo } = makeMocks();
      const entry = makeLedgerEntry({ date: '2025-12-15', deletedAt: undefined });

      (ledgerRepository.getById as jest.Mock).mockResolvedValue(entry);
      (businessRepo.getLockedPeriods as jest.Mock).mockResolvedValue(['2025-12']);

      await expect(
        service.softDeleteEntry('biz-cotonou-001', 'entry-001'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when businessId is empty', async () => {
      const { service } = makeMocks();
      await expect(service.softDeleteEntry('', 'entry-001')).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when id is empty', async () => {
      const { service } = makeMocks();
      await expect(service.softDeleteEntry('biz-cotonou-001', '')).rejects.toThrow(ValidationError);
    });
  });
});
