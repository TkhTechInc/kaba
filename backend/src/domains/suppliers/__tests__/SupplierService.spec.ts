import { SupplierService } from '../services/SupplierService';
import { SupplierPaymentService } from '../services/SupplierPaymentService';
import { SupplierRepository } from '../repositories/SupplierRepository';
import { Supplier } from '../models/Supplier';
import { NotFoundError } from '@/shared/errors/DomainError';
import type { LedgerService } from '@/domains/ledger/services/LedgerService';
import type { LedgerEntry } from '@/domains/ledger/models/LedgerEntry';
import type { PaymentsClient } from '@/domains/payments/services/PaymentsClient';
import type { BusinessRepository } from '@/domains/business/BusinessRepository';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 'sup-001',
    businessId: 'biz-ng-001',
    name: 'Adeola Wholesalers',
    currency: 'NGN',
    countryCode: 'NG',
    phone: '+2348012345678',
    momoPhone: '+2348099999999',
    bankAccount: '0123456789',
    notes: 'Net 30 payment terms',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeMockRepo(): jest.Mocked<SupplierRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    listByBusiness: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<SupplierRepository>;
}

function makeMockLedgerService(): jest.Mocked<LedgerService> {
  return {
    createEntry: jest.fn(),
    listEntries: jest.fn(),
    getEntry: jest.fn(),
  } as unknown as jest.Mocked<LedgerService>;
}

// ── SupplierService tests ─────────────────────────────────────────────────────

describe('SupplierService', () => {
  describe('create', () => {
    it('creates a supplier with the correct fields', async () => {
      const repo = makeMockRepo();
      const service = new SupplierService(repo);
      const expected = makeSupplier();
      repo.create.mockResolvedValue(expected);

      const result = await service.create('biz-ng-001', {
        name: 'Adeola Wholesalers',
        currency: 'NGN',
        countryCode: 'NG',
        phone: '+2348012345678',
        momoPhone: '+2348099999999',
        bankAccount: '0123456789',
        notes: 'Net 30 payment terms',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ businessId: 'biz-ng-001', name: 'Adeola Wholesalers' }),
      );
      expect(result.id).toBe('sup-001');
      expect(result.currency).toBe('NGN');
      expect(result.countryCode).toBe('NG');
    });

    it('creates a minimal supplier without optional fields', async () => {
      const repo = makeMockRepo();
      const service = new SupplierService(repo);
      const minimal = makeSupplier({ phone: undefined, momoPhone: undefined, bankAccount: undefined, notes: undefined });
      repo.create.mockResolvedValue(minimal);

      const result = await service.create('biz-ng-001', {
        name: 'Adeola Wholesalers',
        currency: 'NGN',
        countryCode: 'NG',
      });

      expect(result.id).toBe('sup-001');
      expect(result.phone).toBeUndefined();
      expect(result.momoPhone).toBeUndefined();
    });

    it('passes businessId to the repository', async () => {
      const repo = makeMockRepo();
      const service = new SupplierService(repo);
      repo.create.mockResolvedValue(makeSupplier({ businessId: 'biz-sn-002' }));

      await service.create('biz-sn-002', { name: 'Dakar Supplies', currency: 'XOF', countryCode: 'SN' });

      const callArg = repo.create.mock.calls[0][0];
      expect(callArg.businessId).toBe('biz-sn-002');
    });
  });

  describe('list', () => {
    it('returns a paginated list of suppliers for the business', async () => {
      const repo = makeMockRepo();
      const service = new SupplierService(repo);
      const items = [makeSupplier(), makeSupplier({ id: 'sup-002', name: 'Lagos Traders' })];
      repo.listByBusiness.mockResolvedValue(items);

      const result = await service.list('biz-ng-001');

      expect(repo.listByBusiness).toHaveBeenCalledWith('biz-ng-001');
      expect(result.items).toHaveLength(2);
      expect(result.items[1].name).toBe('Lagos Traders');
    });

    it('returns empty list when no suppliers exist', async () => {
      const repo = makeMockRepo();
      const service = new SupplierService(repo);
      repo.listByBusiness.mockResolvedValue([]);

      const result = await service.list('biz-ng-001');
      expect(result.items).toHaveLength(0);
    });
  });

  describe('getById', () => {
    it('returns the supplier when found', async () => {
      const repo = makeMockRepo();
      const service = new SupplierService(repo);
      const supplier = makeSupplier();
      repo.findById.mockResolvedValue(supplier);

      const result = await service.getById('biz-ng-001', 'sup-001');

      expect(result.id).toBe('sup-001');
      expect(result.name).toBe('Adeola Wholesalers');
    });

    it('throws NotFoundError when supplier does not exist', async () => {
      const repo = makeMockRepo();
      const service = new SupplierService(repo);
      repo.findById.mockResolvedValue(null);

      await expect(service.getById('biz-ng-001', 'sup-missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('updates and returns the merged supplier', async () => {
      const repo = makeMockRepo();
      const service = new SupplierService(repo);
      const existing = makeSupplier();
      const updated = makeSupplier({ name: 'Adeola Premium Wholesalers', phone: '+2348099900000' });
      repo.findById.mockResolvedValue(existing);
      repo.update.mockResolvedValue(updated);

      const result = await service.update('biz-ng-001', 'sup-001', {
        name: 'Adeola Premium Wholesalers',
        phone: '+2348099900000',
      });

      expect(repo.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Adeola Premium Wholesalers', phone: '+2348099900000' }),
      );
      expect(result.name).toBe('Adeola Premium Wholesalers');
    });

    it('throws NotFoundError when supplier to update does not exist', async () => {
      const repo = makeMockRepo();
      const service = new SupplierService(repo);
      repo.findById.mockResolvedValue(null);

      await expect(
        service.update('biz-ng-001', 'sup-missing', { name: 'Updated Name' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('preserves existing fields when partial update is applied', async () => {
      const repo = makeMockRepo();
      const service = new SupplierService(repo);
      const existing = makeSupplier({ notes: 'Old notes', bankAccount: 'ACC123' });
      const merged = makeSupplier({ notes: 'New notes', bankAccount: 'ACC123' });
      repo.findById.mockResolvedValue(existing);
      repo.update.mockResolvedValue(merged);

      await service.update('biz-ng-001', 'sup-001', { notes: 'New notes' });

      const callArg = repo.update.mock.calls[0][0];
      expect(callArg.bankAccount).toBe('ACC123');
      expect(callArg.notes).toBe('New notes');
    });
  });

  describe('delete', () => {
    it('deletes the supplier when it exists', async () => {
      const repo = makeMockRepo();
      const service = new SupplierService(repo);
      repo.findById.mockResolvedValue(makeSupplier());
      repo.delete.mockResolvedValue(undefined);

      await service.delete('biz-ng-001', 'sup-001');

      expect(repo.delete).toHaveBeenCalledWith('biz-ng-001', 'sup-001');
    });

    it('throws NotFoundError when supplier to delete does not exist', async () => {
      const repo = makeMockRepo();
      const service = new SupplierService(repo);
      repo.findById.mockResolvedValue(null);

      await expect(service.delete('biz-ng-001', 'sup-missing')).rejects.toThrow(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});

// ── SupplierPaymentService tests ──────────────────────────────────────────────

describe('SupplierPaymentService', () => {
  function makeMockPaymentsClient() {
    return {
      disburse: jest.fn().mockResolvedValue({ success: true, transactionId: 'tx-001' }),
    } as unknown as jest.Mocked<PaymentsClient>;
  }

  function makePaymentService() {
    const repo = makeMockRepo();
    const ledger = makeMockLedgerService();
    const paymentsClient = makeMockPaymentsClient();
    const businessRepo = {
      getById: jest.fn().mockResolvedValue({ countryCode: 'NG' }),
    } as unknown as BusinessRepository;
    const service = new SupplierPaymentService(
      repo,
      ledger as unknown as LedgerService,
      paymentsClient,
      businessRepo,
    );
    return { repo, ledger, paymentsClient, businessRepo, service };
  }

  function makeLedgerEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
    return {
      id: 'entry-001',
      businessId: 'biz-ng-001',
      type: 'expense',
      amount: 50000,
      currency: 'NGN',
      description: 'Payment to supplier Adeola Wholesalers',
      category: 'supplier_payment',
      date: '2026-03-07',
      supplierId: 'sup-001',
      createdAt: '2026-03-07T10:00:00.000Z',
      ...overrides,
    };
  }

  it('records a ledger expense when paying a supplier', async () => {
    const { repo, ledger, service } = makePaymentService();
    const supplier = makeSupplier();
    repo.findById.mockResolvedValue(supplier);
    ledger.createEntry.mockResolvedValue(makeLedgerEntry());

    const result = await service.paySupplier('biz-ng-001', 'sup-001', 50000, 'NGN', 'Monthly stock payment');

    expect(result.success).toBe(true);
    expect(result.ledgerEntryId).toBe('entry-001');
  });

  it('creates ledger entry with correct type=expense and supplierId', async () => {
    const { repo, ledger, service } = makePaymentService();
    repo.findById.mockResolvedValue(makeSupplier());
    ledger.createEntry.mockResolvedValue(makeLedgerEntry());

    await service.paySupplier('biz-ng-001', 'sup-001', 75000, 'NGN', 'Q1 order');

    expect(ledger.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'biz-ng-001',
        type: 'expense',
        amount: 75000,
        currency: 'NGN',
        supplierId: 'sup-001',
        category: 'supplier_payment',
      }),
    );
  });

  it('uses default description when no description provided', async () => {
    const { repo, ledger, service } = makePaymentService();
    repo.findById.mockResolvedValue(makeSupplier({ name: 'Adeola Wholesalers' }));
    ledger.createEntry.mockResolvedValue(makeLedgerEntry());

    await service.paySupplier('biz-ng-001', 'sup-001', 20000, 'NGN');

    const callArg = ledger.createEntry.mock.calls[0][0];
    expect(callArg.description).toContain('Adeola Wholesalers');
  });

  it('throws NotFoundError when supplier does not exist', async () => {
    const { repo, ledger, service } = makePaymentService();
    repo.findById.mockResolvedValue(null);

    await expect(
      service.paySupplier('biz-ng-001', 'sup-missing', 10000, 'NGN'),
    ).rejects.toThrow(NotFoundError);

    expect(ledger.createEntry).not.toHaveBeenCalled();
  });

  it('handles multi-currency supplier payment (XOF)', async () => {
    const { repo, ledger, service } = makePaymentService();
    repo.findById.mockResolvedValue(makeSupplier({ currency: 'XOF', countryCode: 'SN' }));
    ledger.createEntry.mockResolvedValue(
      makeLedgerEntry({ amount: 150000, currency: 'XOF' }),
    );

    const result = await service.paySupplier('biz-ng-001', 'sup-001', 150000, 'XOF', 'Dakar order');

    expect(result.success).toBe(true);
    const callArg = ledger.createEntry.mock.calls[0][0];
    expect(callArg.currency).toBe('XOF');
    expect(callArg.amount).toBe(150000);
  });

  it('calls paymentsClient.disburse when supplier has momoPhone', async () => {
    const { repo, ledger, paymentsClient, service } = makePaymentService();
    repo.findById.mockResolvedValue(makeSupplier({ momoPhone: '+22997123456' }));
    ledger.createEntry.mockResolvedValue(makeLedgerEntry({ id: 'entry-xyz' }));

    await service.paySupplier('biz-ng-001', 'sup-001', 25000, 'XOF', 'Stock payment');

    expect(paymentsClient.disburse).toHaveBeenCalledWith({
      phone: '+22997123456',
      amount: 25000,
      currency: 'XOF',
      externalId: 'qb-biz-ng-001-sup-001-entry-xyz',
      referenceId: 'sup-001-entry-xyz',
      country: 'NG',
    });
  });

  it('calls paymentsClient.disburse with phone when supplier has no momoPhone but has phone', async () => {
    const { repo, ledger, paymentsClient, service } = makePaymentService();
    repo.findById.mockResolvedValue(makeSupplier({ momoPhone: undefined, phone: '+2348012345678' }));
    ledger.createEntry.mockResolvedValue(makeLedgerEntry({ id: 'entry-abc' }));

    await service.paySupplier('biz-ng-001', 'sup-001', 10000, 'NGN');

    expect(paymentsClient.disburse).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+2348012345678',
        amount: 10000,
        currency: 'NGN',
        referenceId: 'sup-001-entry-abc',
        country: 'NG',
      }),
    );
    expect((paymentsClient.disburse as jest.Mock).mock.calls[0][0].externalId).toContain('qb-biz-ng-001-sup-001-entry-abc');
  });

  it('does not call paymentsClient.disburse when supplier has no phone', async () => {
    const { repo, ledger, paymentsClient, service } = makePaymentService();
    repo.findById.mockResolvedValue(makeSupplier({ momoPhone: undefined, phone: undefined }));
    ledger.createEntry.mockResolvedValue(makeLedgerEntry());

    await service.paySupplier('biz-ng-001', 'sup-001', 5000, 'NGN');

    expect(paymentsClient.disburse).not.toHaveBeenCalled();
  });
});
