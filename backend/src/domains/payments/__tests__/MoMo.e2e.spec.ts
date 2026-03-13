/**
 * E2E tests for MoMo payment flow.
 *
 * Two modes:
 * 1. Default (mocked): Uses nock to mock TKH Payments. No real services needed.
 *    Run: npx jest MoMo.e2e --no-coverage --verbose
 *
 * 2. Live: Set MOMO_E2E_LIVE=1 and PAYMENTS_SERVICE_URL to hit real TKH Payments + MoMo sandbox.
 *    Requires: TKH Payments running with MoMo, valid share token, MTN sandbox number.
 *    Run: MOMO_E2E_LIVE=1 MOMO_E2E_TOKEN=xxx MOMO_E2E_PHONE=+233241234567 \
 *         PAYMENTS_SERVICE_URL=https://payments.example.com npx jest MoMo.e2e --no-coverage
 */

import nock from 'nock';
import { InvoiceShareService } from '@/domains/invoicing/services/InvoiceShareService';
import { PaymentsClient } from '@/domains/payments/services/PaymentsClient';
import type { InvoiceShareRepository } from '@/domains/invoicing/repositories/InvoiceShareRepository';
import type { InvoiceRepository } from '@/domains/invoicing/repositories/InvoiceRepository';
import type { BusinessRepository } from '@/domains/business/BusinessRepository';
import type { CustomerRepository } from '@/domains/invoicing/repositories/CustomerRepository';
import type { InvoiceService } from '@/domains/invoicing/services/InvoiceService';

const LIVE = process.env['MOMO_E2E_LIVE'] === '1';
const LIVE_TOKEN = process.env['MOMO_E2E_TOKEN'];
const LIVE_PHONE = process.env['MOMO_E2E_PHONE'] ?? '+233241234567';
const PAYMENTS_URL = process.env['PAYMENTS_SERVICE_URL'];

const describeIfLive = LIVE && LIVE_TOKEN && PAYMENTS_URL ? describe : describe.skip;

function makeShareRecord(token: string) {
  return {
    token,
    invoiceId: 'inv-e2e-001',
    businessId: 'biz-e2e-001',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
}

function makeInvoice() {
  return {
    id: 'inv-e2e-001',
    businessId: 'biz-e2e-001',
    amount: 5000,
    currency: 'XOF',
    status: 'sent',
    items: [{ description: 'E2E test', quantity: 1, unitPrice: 5000, amount: 5000 }],
    dueDate: '2026-12-31',
    createdAt: new Date().toISOString(),
    customerId: 'cust-001',
  };
}

function makeBusiness() {
  return {
    id: 'biz-e2e-001',
    name: 'E2E Business',
    countryCode: 'BJ',
  };
}

function makeService(
  paymentsClient: PaymentsClient,
  overrides: {
    shareRepo?: Partial<InvoiceShareRepository>;
    invoiceRepo?: Partial<InvoiceRepository>;
    businessRepo?: Partial<BusinessRepository>;
  } = {},
): InvoiceShareService {
  const shareRepo = {
    getByToken: jest.fn(),
    ...overrides.shareRepo,
  } as unknown as InvoiceShareRepository;
  const invoiceRepo = {
    getById: jest.fn(),
    ...overrides.invoiceRepo,
  } as unknown as InvoiceRepository;
  const businessRepo = {
    getById: jest.fn(),
    ...overrides.businessRepo,
  } as unknown as BusinessRepository;
  const configService = { get: jest.fn() } as any;

  return new InvoiceShareService(
    shareRepo,
    invoiceRepo,
    {} as CustomerRepository,
    businessRepo,
    {} as InvoiceService,
    paymentsClient,
    configService,
  );
}

describe('MoMo E2E (mocked TKH Payments)', () => {
  const MOCK_BASE = 'https://payments-e2e-mock.example.com';
  let paymentsClient: PaymentsClient;
  let invoiceShareService: InvoiceShareService;
  let shareRepo: { getByToken: jest.Mock };
  let invoiceRepo: { getById: jest.Mock };
  let businessRepo: { getById: jest.Mock };

  beforeAll(() => {
    // Disable MoMo test override so XOF is sent to nock (not EUR)
    delete process.env['MOMO_TEST_CURRENCY'];
    delete process.env['MOMO_TEST_COUNTRY'];
    delete process.env['MOMO_TEST_FORCE_GH'];
    const prev = process.env['PAYMENTS_SERVICE_URL'];
    process.env['PAYMENTS_SERVICE_URL'] = MOCK_BASE;
    paymentsClient = new PaymentsClient();
    shareRepo = { getByToken: jest.fn() };
    invoiceRepo = { getById: jest.fn() };
    businessRepo = { getById: jest.fn() };
    invoiceShareService = makeService(paymentsClient, {
      shareRepo: shareRepo as any,
      invoiceRepo: invoiceRepo as any,
      businessRepo: businessRepo as any,
    });
    if (prev !== undefined) process.env['PAYMENTS_SERVICE_URL'] = prev;
    else delete process.env['PAYMENTS_SERVICE_URL'];
  });

  beforeEach(() => {
    process.env['PAYMENTS_SERVICE_URL'] = MOCK_BASE;
    nock.cleanAll();
  });

  it('full flow: requestMoMoPayment -> PaymentsClient -> TKH Payments -> success', async () => {
    const token = 'e2e-tok-' + Date.now();
    shareRepo.getByToken.mockResolvedValue(makeShareRecord(token));
    invoiceRepo.getById.mockResolvedValue(makeInvoice());
    businessRepo.getById.mockResolvedValue(makeBusiness());

    nock(MOCK_BASE)
      .post('/intents/request-momo', (body) => {
        expect(body.amount).toBe(5000);
        expect(body.currency).toBe('XOF');
        expect(body.phone).toMatch(/^\+/);
        expect(body.metadata.invoiceId).toBe('inv-e2e-001');
        return true;
      })
      .reply(200, { success: true });

    const result = await invoiceShareService.requestMoMoPayment(token, '+22997123456');

    expect(result.success).toBe(true);
  });

  it('full flow: requestMoMoPayment -> PaymentsClient -> TKH Payments -> failure', async () => {
    const token = 'e2e-tok-fail';
    shareRepo.getByToken.mockResolvedValue(makeShareRecord(token));
    invoiceRepo.getById.mockResolvedValue(makeInvoice());
    businessRepo.getById.mockResolvedValue(makeBusiness());

    nock(MOCK_BASE)
      .post('/intents/request-momo')
      .reply(200, { success: false, error: 'User rejected' });

    const result = await invoiceShareService.requestMoMoPayment(token, '+22997123456');

    expect(result.success).toBe(false);
    expect(result.error).toBe('User rejected');
  });
});

describeIfLive('MoMo E2E (live TKH Payments + MoMo sandbox)', () => {
  let invoiceShareService: InvoiceShareService;

  beforeAll(() => {
    const paymentsClient = new PaymentsClient();
    const shareRepo = { getByToken: jest.fn().mockResolvedValue(makeShareRecord(LIVE_TOKEN!)) };
    const invoiceRepo = { getById: jest.fn().mockResolvedValue(makeInvoice()) };
    const businessRepo = { getById: jest.fn().mockResolvedValue(makeBusiness()) };
    invoiceShareService = makeService(paymentsClient, {
      shareRepo: shareRepo as any,
      invoiceRepo: invoiceRepo as any,
      businessRepo: businessRepo as any,
    });
  });

  it('sends RequestToPay to MoMo sandbox via TKH Payments', async () => {
    const result = await invoiceShareService.requestMoMoPayment(LIVE_TOKEN!, LIVE_PHONE);

    expect(result.success).toBe(true);
    // User must approve on MTN sandbox simulator to complete payment
  }, 15000);
});
