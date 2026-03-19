import { InvoiceService } from '../services/InvoiceService';
import { Invoice, InvoiceStatus } from '../models/Invoice';
import { NotFoundError, ValidationError } from '@/shared/errors/DomainError';

// ---------------------------------------------------------------------------
// Fixed date constant to avoid flaky time-dependent tests
// ---------------------------------------------------------------------------
const FIXED_NOW = '2026-03-07T12:00:00.000Z';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-abc-001',
    businessId: 'biz-sn-001',
    customerId: 'cust-001',
    amount: 150000,
    currency: 'XOF',
    status: 'draft',
    items: [
      { description: 'Consulting comptable', quantity: 1, unitPrice: 150000, amount: 150000 },
    ],
    dueDate: '2026-04-01',
    createdAt: FIXED_NOW,
    ...overrides,
  };
}

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cust-001',
    businessId: 'biz-sn-001',
    name: 'Aminata Diallo',
    email: 'aminata.diallo@example.sn',
    phone: '+221771234567',
    ...overrides,
  };
}

function makeBusiness(overrides: Record<string, unknown> = {}) {
  return {
    id: 'biz-sn-001',
    name: 'Diallo Commerce SARL',
    countryCode: 'SN',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeServiceWithMocks() {
  const invoiceRepository = {
    create: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    updateStatusWithPaymentIntent: jest.fn(),
    listAllByBusiness: jest.fn(),
    listByBusiness: jest.fn(),
    listByBusinessAndStatus: jest.fn(),
    countByBusiness: jest.fn(),
    approve: jest.fn(),
    updateMECeF: jest.fn(),
    softDelete: jest.fn(),
  };

  const customerRepository = {
    getById: jest.fn(),
    create: jest.fn(),
    listByBusiness: jest.fn(),
  };

  const paymentsClient = {
    createIntent: jest.fn(),
  };

  const webhookService = {
    emit: jest.fn(),
  };

  const businessRepository = {
    getById: jest.fn(),
    getOrCreate: jest.fn(),
  };

  const accessService = {
    getUserRole: jest.fn(),
  };

  const emailService = {
    sendInvoice: jest.fn(),
  };

  const invoicePdfService = {
    generateInvoicePdf: jest.fn(),
  };

  const receiptStorageService = {
    isConfigured: jest.fn().mockReturnValue(false),
    uploadInvoicePdf: jest.fn(),
  };

  const service = new InvoiceService(
    invoiceRepository as any,
    customerRepository as any,
    paymentsClient as any,
    webhookService as any,
    businessRepository as any,
    accessService as any,
    emailService as any,
    invoicePdfService as any,
    receiptStorageService as any,
  );

  return {
    service,
    invoiceRepository,
    customerRepository,
    paymentsClient,
    webhookService,
    businessRepository,
    accessService,
    emailService,
    invoicePdfService,
    receiptStorageService,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvoiceService', () => {
  describe('create', () => {
    it('creates an invoice with correct fields and status=draft', async () => {
      const { service, invoiceRepository, customerRepository, businessRepository, accessService, webhookService } = makeServiceWithMocks();

      const customer = makeCustomer();
      const business = makeBusiness();
      const createdInvoice = makeInvoice({ status: 'draft' });

      customerRepository.getById.mockResolvedValue(customer);
      businessRepository.getById.mockResolvedValue(business);
      accessService.getUserRole.mockResolvedValue('owner');
      invoiceRepository.create.mockResolvedValue(createdInvoice);
      webhookService.emit.mockReturnValue(undefined);

      const result = await service.create({
        businessId: 'biz-sn-001',
        customerId: 'cust-001',
        amount: 150000,
        currency: 'XOF',
        items: [{ description: 'Consulting comptable', quantity: 1, unitPrice: 150000, amount: 150000 }],
        dueDate: '2026-04-01',
      });

      expect(result.status).toBe('draft');
      expect(result.amount).toBe(150000);
      expect(result.currency).toBe('XOF');
      expect(result.businessId).toBe('biz-sn-001');
      expect(invoiceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz-sn-001',
          customerId: 'cust-001',
          currency: 'XOF',
        }),
      );
    });

    it('throws ValidationError when items have zero total amount', async () => {
      const { service, customerRepository } = makeServiceWithMocks();
      customerRepository.getById.mockResolvedValue(makeCustomer());

      await expect(
        service.create({
          businessId: 'biz-sn-001',
          customerId: 'cust-001',
          amount: 0,
          currency: 'XOF',
          items: [{ description: 'Rien', quantity: 1, unitPrice: 0, amount: 0 }],
          dueDate: '2026-04-01',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError when customer does not exist', async () => {
      const { service, customerRepository } = makeServiceWithMocks();
      customerRepository.getById.mockResolvedValue(null);

      await expect(
        service.create({
          businessId: 'biz-sn-001',
          customerId: 'cust-nonexistent',
          amount: 50000,
          currency: 'XOF',
          items: [{ description: 'Service', quantity: 1, unitPrice: 50000, amount: 50000 }],
          dueDate: '2026-04-01',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('creates invoice as pending_approval for sales role user', async () => {
      const { service, invoiceRepository, customerRepository, businessRepository, accessService } = makeServiceWithMocks();

      customerRepository.getById.mockResolvedValue(makeCustomer());
      businessRepository.getById.mockResolvedValue(makeBusiness());
      accessService.getUserRole.mockResolvedValue('sales');

      const pendingInvoice = makeInvoice({ status: 'pending_approval' });
      invoiceRepository.create.mockResolvedValue(pendingInvoice);

      const result = await service.create(
        {
          businessId: 'biz-sn-001',
          customerId: 'cust-001',
          amount: 75000,
          currency: 'XOF',
          items: [{ description: 'Produits', quantity: 3, unitPrice: 25000, amount: 75000 }],
          dueDate: '2026-04-15',
        },
        'user-sales-001',
      );

      expect(invoiceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending_approval' }),
      );
      expect(result.status).toBe('pending_approval');
    });
  });

  describe('sendInvoice', () => {
    it('sends invoice by email and changes status to sent', async () => {
      const { service, invoiceRepository, customerRepository, businessRepository, emailService, invoicePdfService } = makeServiceWithMocks();

      const invoice = makeInvoice({ status: 'draft' });
      const customer = makeCustomer();
      const business = makeBusiness();
      const pdfBuffer = Buffer.from('fake-pdf');

      invoiceRepository.getById.mockResolvedValue(invoice);
      customerRepository.getById.mockResolvedValue(customer);
      businessRepository.getById.mockResolvedValue(business);
      invoicePdfService.generateInvoicePdf.mockResolvedValue(pdfBuffer);
      emailService.sendInvoice.mockResolvedValue({ success: true });
      invoiceRepository.updateStatus.mockResolvedValue({ ...invoice, status: 'sent' });

      const result = await service.sendInvoice('biz-sn-001', 'inv-abc-001');

      expect(result.sent).toBe(true);
      expect(result.channel).toBe('email');
      expect(invoiceRepository.updateStatus).toHaveBeenCalledWith('biz-sn-001', 'inv-abc-001', 'sent');
      expect(emailService.sendInvoice).toHaveBeenCalledWith(
        customer.email,
        expect.stringContaining('Invoice'),
        expect.any(String),
        pdfBuffer,
        'inv-abc-001',
      );
    });

    it('throws ValidationError when customer has no email', async () => {
      const { service, invoiceRepository, customerRepository, businessRepository } = makeServiceWithMocks();

      invoiceRepository.getById.mockResolvedValue(makeInvoice());
      customerRepository.getById.mockResolvedValue(makeCustomer({ email: '' }));
      businessRepository.getById.mockResolvedValue(makeBusiness());

      await expect(
        service.sendInvoice('biz-sn-001', 'inv-abc-001'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError when invoice does not exist', async () => {
      const { service, invoiceRepository } = makeServiceWithMocks();
      invoiceRepository.getById.mockResolvedValue(null);

      await expect(
        service.sendInvoice('biz-sn-001', 'inv-nonexistent'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('markPaidFromWebhook', () => {
    it('changes invoice status to paid', async () => {
      const { service, invoiceRepository, webhookService } = makeServiceWithMocks();

      const invoice = makeInvoice({ status: 'sent' });
      const paidInvoice = { ...invoice, status: 'paid' as InvoiceStatus };

      invoiceRepository.getById.mockResolvedValue(invoice);
      invoiceRepository.updateStatusWithPaymentIntent.mockResolvedValue(paidInvoice);
      webhookService.emit.mockReturnValue(undefined);

      const result = await service.markPaidFromWebhook('biz-sn-001', 'inv-abc-001');

      expect(result?.status).toBe('paid');
      expect(invoiceRepository.updateStatusWithPaymentIntent).toHaveBeenCalledWith(
        'biz-sn-001',
        'inv-abc-001',
        'paid',
        undefined,
      );
    });

    it('emits invoice.paid webhook after marking paid', async () => {
      const { service, invoiceRepository, webhookService } = makeServiceWithMocks();

      const invoice = makeInvoice({ status: 'sent' });
      const paidInvoice = { ...invoice, status: 'paid' as InvoiceStatus };

      invoiceRepository.getById.mockResolvedValue(invoice);
      invoiceRepository.updateStatusWithPaymentIntent.mockResolvedValue(paidInvoice);

      await service.markPaidFromWebhook('biz-sn-001', 'inv-abc-001');

      expect(webhookService.emit).toHaveBeenCalledWith(
        'biz-sn-001',
        'invoice.paid',
        expect.objectContaining({ invoiceId: paidInvoice.id }),
      );
    });

    it('returns the invoice unchanged if already paid', async () => {
      const { service, invoiceRepository } = makeServiceWithMocks();

      const alreadyPaid = makeInvoice({ status: 'paid' });
      invoiceRepository.getById.mockResolvedValue(alreadyPaid);

      const result = await service.markPaidFromWebhook('biz-sn-001', 'inv-abc-001');

      expect(result?.status).toBe('paid');
      expect(invoiceRepository.updateStatusWithPaymentIntent).not.toHaveBeenCalled();
    });

    it('returns null for empty invoiceId', async () => {
      const { service } = makeServiceWithMocks();
      const result = await service.markPaidFromWebhook('biz-sn-001', '');
      expect(result).toBeNull();
    });
  });

  describe('listUnpaid', () => {
    it('returns only unpaid invoices for the given businessId', async () => {
      const { service, invoiceRepository } = makeServiceWithMocks();

      const allInvoices: Invoice[] = [
        makeInvoice({ id: 'inv-001', status: 'draft' }),
        makeInvoice({ id: 'inv-002', status: 'sent' }),
        makeInvoice({ id: 'inv-003', status: 'paid' }),
        makeInvoice({ id: 'inv-004', status: 'cancelled' }),
        makeInvoice({ id: 'inv-005', status: 'overdue' }),
      ];

      invoiceRepository.listAllByBusiness.mockResolvedValue(allInvoices);

      const result = await service.listUnpaid('biz-sn-001');

      expect(result.length).toBe(3);
      const statuses = result.map((inv) => inv.status);
      expect(statuses).not.toContain('paid');
      expect(statuses).not.toContain('cancelled');
      expect(statuses).toContain('draft');
      expect(statuses).toContain('sent');
      expect(statuses).toContain('overdue');
    });

    it('excludes soft-deleted invoices from unpaid list', async () => {
      const { service, invoiceRepository } = makeServiceWithMocks();

      const allInvoices: Invoice[] = [
        makeInvoice({ id: 'inv-001', status: 'draft' }),
        makeInvoice({ id: 'inv-002', status: 'sent', deletedAt: '2026-01-15T10:00:00.000Z' }),
      ];

      invoiceRepository.listAllByBusiness.mockResolvedValue(allInvoices);

      const result = await service.listUnpaid('biz-sn-001');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('inv-001');
    });
  });

  describe('generatePaymentLink', () => {
    it('calls paymentsClient.createIntent and returns paymentUrl', async () => {
      const { service, invoiceRepository, businessRepository, paymentsClient } = makeServiceWithMocks();

      const invoice = makeInvoice({ status: 'draft' });
      const business = makeBusiness();

      invoiceRepository.getById.mockResolvedValue(invoice);
      businessRepository.getById.mockResolvedValue(business);
      paymentsClient.createIntent.mockResolvedValue({
        success: true,
        paymentUrl: 'https://pay.kaba.africa/inv-abc-001',
        intentId: 'pi-001',
      });

      const result = await service.generatePaymentLink('biz-sn-001', 'inv-abc-001');

      expect(result.paymentUrl).toBe('https://pay.kaba.africa/inv-abc-001');
      expect(paymentsClient.createIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: invoice.amount,
          currency: 'XOF',
          metadata: expect.objectContaining({ invoiceId: 'inv-abc-001' }),
        }),
      );
    });

    it('throws ValidationError when payment gateway fails', async () => {
      const { service, invoiceRepository, businessRepository, paymentsClient } = makeServiceWithMocks();

      invoiceRepository.getById.mockResolvedValue(makeInvoice());
      businessRepository.getById.mockResolvedValue(makeBusiness());
      paymentsClient.createIntent.mockResolvedValue({
        success: false,
        error: 'Gateway timeout',
      });

      await expect(
        service.generatePaymentLink('biz-sn-001', 'inv-abc-001'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for a paid invoice', async () => {
      const { service, invoiceRepository } = makeServiceWithMocks();
      invoiceRepository.getById.mockResolvedValue(makeInvoice({ status: 'paid' }));

      await expect(
        service.generatePaymentLink('biz-sn-001', 'inv-abc-001'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for a cancelled invoice', async () => {
      const { service, invoiceRepository } = makeServiceWithMocks();
      invoiceRepository.getById.mockResolvedValue(makeInvoice({ status: 'cancelled' }));

      await expect(
        service.generatePaymentLink('biz-sn-001', 'inv-abc-001'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError when invoice does not exist', async () => {
      const { service, invoiceRepository } = makeServiceWithMocks();
      invoiceRepository.getById.mockResolvedValue(null);

      await expect(
        service.generatePaymentLink('biz-sn-001', 'inv-nonexistent'),
      ).rejects.toThrow(NotFoundError);
    });

    it('applies early payment discount when within discount window', async () => {
      const { service, invoiceRepository, businessRepository, paymentsClient } = makeServiceWithMocks();

      // Freeze time at FIXED_NOW so daysSinceCreation = 0 (within 7-day window)
      jest.useFakeTimers({ now: new Date(FIXED_NOW) });

      const invoice = makeInvoice({
        status: 'draft',
        amount: 100000,
        earlyPaymentDiscountPercent: 5,
        earlyPaymentDiscountDays: 7,
        createdAt: FIXED_NOW,
      });

      invoiceRepository.getById.mockResolvedValue(invoice);
      businessRepository.getById.mockResolvedValue(makeBusiness());
      paymentsClient.createIntent.mockResolvedValue({
        success: true,
        paymentUrl: 'https://pay.kaba.africa/discount',
      });

      await service.generatePaymentLink('biz-sn-001', 'inv-abc-001');

      jest.useRealTimers();

      const callArgs = paymentsClient.createIntent.mock.calls[0][0];
      // 5% off 100000 = 95000
      expect(callArgs.amount).toBe(95000);
    });

    it('does NOT apply early-payment discount when invoice is older than window', async () => {
      const { service, invoiceRepository, businessRepository, paymentsClient } = makeServiceWithMocks();

      // Freeze time at FIXED_NOW; createdAt is 30 days before → 30 days > 7-day window → no discount
      jest.useFakeTimers({ now: new Date(FIXED_NOW) });

      const THIRTY_DAYS_BEFORE = '2026-02-05T12:00:00.000Z';
      const invoice = makeInvoice({
        status: 'draft',
        amount: 100000,
        earlyPaymentDiscountPercent: 5,
        earlyPaymentDiscountDays: 7,
        createdAt: THIRTY_DAYS_BEFORE,
      });

      invoiceRepository.getById.mockResolvedValue(invoice);
      businessRepository.getById.mockResolvedValue(makeBusiness());
      paymentsClient.createIntent.mockResolvedValue({
        success: true,
        paymentUrl: 'https://pay.kaba.africa/no-discount',
      });

      await service.generatePaymentLink('biz-sn-001', 'inv-abc-001');

      jest.useRealTimers();

      const callArgs = paymentsClient.createIntent.mock.calls[0][0];
      // Full amount — no discount because 30 days > 7-day window
      expect(callArgs.amount).toBe(100000);
    });
  });

  describe('getById', () => {
    it('returns invoice when found', async () => {
      const { service, invoiceRepository } = makeServiceWithMocks();
      const invoice = makeInvoice();
      invoiceRepository.getById.mockResolvedValue(invoice);

      const result = await service.getById('biz-sn-001', 'inv-abc-001');

      expect(result.id).toBe('inv-abc-001');
      expect(result.businessId).toBe('biz-sn-001');
    });

    it('throws NotFoundError when invoice does not exist', async () => {
      const { service, invoiceRepository } = makeServiceWithMocks();
      invoiceRepository.getById.mockResolvedValue(null);

      await expect(
        service.getById('biz-sn-001', 'inv-missing'),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
