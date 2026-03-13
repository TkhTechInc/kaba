/**
 * Unit tests for InvoiceShareService, including MoMo RequestToPay flow.
 */
import { InvoiceShareService } from '../services/InvoiceShareService';
import type { InvoiceShareRepository } from '../repositories/InvoiceShareRepository';
import type { InvoiceRepository } from '../repositories/InvoiceRepository';
import type { CustomerRepository } from '../repositories/CustomerRepository';
import type { BusinessRepository } from '@/domains/business/BusinessRepository';
import type { InvoiceService } from '../services/InvoiceService';
import type { PaymentsClient } from '@/domains/payments/services/PaymentsClient';

function makeShareRecord(overrides: Partial<{ token: string; invoiceId: string; businessId: string; expiresAt: string }> = {}) {
  return {
    token: 'tok-abc-123',
    invoiceId: 'inv-001',
    businessId: 'biz-001',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<{ id: string; businessId: string; amount: number; currency: string; status: string }> = {}) {
  return {
    id: 'inv-001',
    businessId: 'biz-001',
    amount: 50000,
    currency: 'XOF',
    status: 'sent',
    items: [{ description: 'Consulting', quantity: 1, unitPrice: 50000, amount: 50000 }],
    dueDate: '2026-04-30',
    createdAt: '2026-03-01T09:00:00.000Z',
    ...overrides,
  };
}

function makeBusiness(overrides: Partial<{ id: string; countryCode: string }> = {}) {
  return {
    id: 'biz-001',
    name: 'Test Business',
    countryCode: 'BJ',
    ...overrides,
  };
}

describe('InvoiceShareService.requestMoMoPayment', () => {
  function makeService(overrides: {
    shareRepo?: Partial<InvoiceShareRepository>;
    invoiceRepo?: Partial<InvoiceRepository>;
    businessRepo?: Partial<BusinessRepository>;
    paymentsClient?: Partial<PaymentsClient>;
  } = {}) {
    const shareRepo = {
      getByToken: jest.fn(),
      ...overrides.shareRepo,
    } as unknown as InvoiceShareRepository;
    const invoiceRepo = {
      getById: jest.fn(),
      ...overrides.invoiceRepo,
    } as unknown as InvoiceRepository;
    const customerRepo = {} as CustomerRepository;
    const businessRepo = {
      getById: jest.fn(),
      ...overrides.businessRepo,
    } as unknown as BusinessRepository;
    const invoiceService = {} as InvoiceService;
    const paymentsClient = {
      requestMoMoPayment: jest.fn(),
      ...overrides.paymentsClient,
    } as unknown as PaymentsClient;
    const configService = { get: jest.fn() } as any;

    return new InvoiceShareService(
      shareRepo,
      invoiceRepo,
      customerRepo,
      businessRepo,
      invoiceService,
      paymentsClient,
      configService,
    );
  }

  it('returns error when token is invalid', async () => {
    const shareRepo = { getByToken: jest.fn().mockResolvedValue(null) };
    const service = makeService({ shareRepo: shareRepo as any });

    const result = await service.requestMoMoPayment('bad-token', '+22997123456');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid or expired');
  });

  it('returns error when link is expired', async () => {
    const shareRepo = {
      getByToken: jest.fn().mockResolvedValue(
        makeShareRecord({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
      ),
    };
    const service = makeService({ shareRepo: shareRepo as any });

    const result = await service.requestMoMoPayment('tok-abc', '+22997123456');

    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('returns error when invoice is already paid', async () => {
    const shareRepo = { getByToken: jest.fn().mockResolvedValue(makeShareRecord()) };
    const invoiceRepo = { getById: jest.fn().mockResolvedValue(makeInvoice({ status: 'paid' })) };
    const businessRepo = { getById: jest.fn().mockResolvedValue(makeBusiness()) };
    const service = makeService({
      shareRepo: shareRepo as any,
      invoiceRepo: invoiceRepo as any,
      businessRepo: businessRepo as any,
    });

    const result = await service.requestMoMoPayment('tok-abc', '+22997123456');

    expect(result.success).toBe(false);
    expect(result.error).toContain('already paid');
  });

  it('returns error when phone is invalid', async () => {
    const shareRepo = { getByToken: jest.fn().mockResolvedValue(makeShareRecord()) };
    const invoiceRepo = { getById: jest.fn().mockResolvedValue(makeInvoice()) };
    const businessRepo = { getById: jest.fn().mockResolvedValue(makeBusiness()) };
    const service = makeService({
      shareRepo: shareRepo as any,
      invoiceRepo: invoiceRepo as any,
      businessRepo: businessRepo as any,
    });

    const result = await service.requestMoMoPayment('tok-abc', 'invalid');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid phone');
  });

  it('calls PaymentsClient.requestMoMoPayment with normalized phone and returns success', async () => {
    const shareRepo = { getByToken: jest.fn().mockResolvedValue(makeShareRecord()) };
    const invoiceRepo = { getById: jest.fn().mockResolvedValue(makeInvoice()) };
    const businessRepo = { getById: jest.fn().mockResolvedValue(makeBusiness({ countryCode: 'BJ' })) };
    const paymentsClient = {
      requestMoMoPayment: jest.fn().mockResolvedValue({ success: true }),
    };
    const service = makeService({
      shareRepo: shareRepo as any,
      invoiceRepo: invoiceRepo as any,
      businessRepo: businessRepo as any,
      paymentsClient: paymentsClient as any,
    });

    const result = await service.requestMoMoPayment('tok-abc', '97 12 34 56');

    expect(result.success).toBe(true);
    expect(paymentsClient.requestMoMoPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 50000,
        currency: 'XOF',
        countryCode: 'BJ',
        metadata: expect.objectContaining({
          invoiceId: 'inv-001',
        }),
      }),
    );
    expect((paymentsClient.requestMoMoPayment as jest.Mock).mock.calls[0][0].phone).toMatch(/^\+229/);
  });

  it('returns error when PaymentsClient.requestMoMoPayment fails', async () => {
    const shareRepo = { getByToken: jest.fn().mockResolvedValue(makeShareRecord()) };
    const invoiceRepo = { getById: jest.fn().mockResolvedValue(makeInvoice()) };
    const businessRepo = { getById: jest.fn().mockResolvedValue(makeBusiness()) };
    const paymentsClient = {
      requestMoMoPayment: jest.fn().mockResolvedValue({ success: false, error: 'Insufficient funds' }),
    };
    const service = makeService({
      shareRepo: shareRepo as any,
      invoiceRepo: invoiceRepo as any,
      businessRepo: businessRepo as any,
      paymentsClient: paymentsClient as any,
    });

    const result = await service.requestMoMoPayment('tok-abc', '+22997123456');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient funds');
  });
});
