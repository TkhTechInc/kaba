/**
 * Tests for the Customer Portal endpoints on CustomerController.
 * These are public endpoints — no auth required.
 *
 * portalLookup  → GET /api/v1/customers/portal/lookup
 * portalInvoices → GET /api/v1/customers/portal/invoices
 */
import { CustomerController } from '../CustomerController';
import type { CustomerService } from '../services/CustomerService';
import type { CustomerRepository } from '../repositories/CustomerRepository';
import type { InvoiceRepository } from '../repositories/InvoiceRepository';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Customer } from '../models/Customer';
import type { Invoice } from '../models/Invoice';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-aaa-001',
    businessId: 'biz-sn-001',
    name: 'Aminata Diallo',
    email: 'aminata@example.sn',
    phone: '+221771234567',
    createdAt: '2026-01-15T09:00:00.000Z',
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-001',
    businessId: 'biz-sn-001',
    customerId: 'cust-aaa-001',
    amount: 150000,
    currency: 'XOF',
    status: 'sent',
    items: [{ description: 'Consulting', quantity: 1, unitPrice: 150000, amount: 150000 }],
    dueDate: '2026-04-30',
    createdAt: '2026-03-01T09:00:00.000Z',
    ...overrides,
  };
}

function makeController() {
  const customerService = {
    create: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<CustomerService>;

  const customerRepository = {
    findByEmail: jest.fn(),
    listWithCursor: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<CustomerRepository>;

  const invoiceRepository = {
    listByCustomerId: jest.fn(),
    create: jest.fn(),
    getById: jest.fn(),
  } as unknown as jest.Mocked<InvoiceRepository>;

  const controller = new CustomerController(
    customerService,
    customerRepository,
    invoiceRepository,
  );

  return { controller, customerService, customerRepository, invoiceRepository };
}

// ── portalLookup tests ────────────────────────────────────────────────────────

describe('CustomerController.portalLookup (public)', () => {
  it('returns customerId and name when customer exists', async () => {
    const { controller, customerRepository } = makeController();
    const customer = makeCustomer();
    customerRepository.findByEmail.mockResolvedValue(customer);

    const result = await controller.portalLookup('biz-sn-001', 'aminata@example.sn');

    expect(result.success).toBe(true);
    expect(result.data.customerId).toBe('cust-aaa-001');
    expect(result.data.name).toBe('Aminata Diallo');
  });

  it('lowercases the email before lookup', async () => {
    const { controller, customerRepository } = makeController();
    customerRepository.findByEmail.mockResolvedValue(makeCustomer());

    await controller.portalLookup('biz-sn-001', 'AMINATA@EXAMPLE.SN');

    expect(customerRepository.findByEmail).toHaveBeenCalledWith('biz-sn-001', 'aminata@example.sn');
  });

  it('trims whitespace from email before lookup', async () => {
    const { controller, customerRepository } = makeController();
    customerRepository.findByEmail.mockResolvedValue(makeCustomer());

    await controller.portalLookup('biz-sn-001', '  aminata@example.sn  ');

    expect(customerRepository.findByEmail).toHaveBeenCalledWith('biz-sn-001', 'aminata@example.sn');
  });

  it('throws NotFoundException when customer is not found', async () => {
    const { controller, customerRepository } = makeController();
    customerRepository.findByEmail.mockResolvedValue(null);

    await expect(
      controller.portalLookup('biz-sn-001', 'ghost@example.sn'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when businessId is missing', async () => {
    const { controller } = makeController();

    await expect(
      controller.portalLookup('', 'aminata@example.sn'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when email is missing', async () => {
    const { controller } = makeController();

    await expect(
      controller.portalLookup('biz-sn-001', ''),
    ).rejects.toThrow(BadRequestException);
  });
});

// ── portalInvoices tests ──────────────────────────────────────────────────────

describe('CustomerController.portalInvoices (public)', () => {
  it('returns sent and overdue invoices for a customer', async () => {
    const { controller, invoiceRepository } = makeController();
    const items: Invoice[] = [
      makeInvoice({ id: 'inv-001', status: 'sent' }),
      makeInvoice({ id: 'inv-002', status: 'overdue' }),
      makeInvoice({ id: 'inv-003', status: 'paid' }),
    ];
    invoiceRepository.listByCustomerId.mockResolvedValue(items);

    const result = await controller.portalInvoices('biz-sn-001', 'cust-aaa-001');

    expect(result.success).toBe(true);
    expect(result.data.items).toHaveLength(3);
  });

  it('filters out draft invoices from portal response', async () => {
    const { controller, invoiceRepository } = makeController();
    const items: Invoice[] = [
      makeInvoice({ id: 'inv-001', status: 'sent' }),
      makeInvoice({ id: 'inv-draft', status: 'draft' }),
    ];
    invoiceRepository.listByCustomerId.mockResolvedValue(items);

    const result = await controller.portalInvoices('biz-sn-001', 'cust-aaa-001');

    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].status).toBe('sent');
  });

  it('filters out cancelled invoices from portal response', async () => {
    const { controller, invoiceRepository } = makeController();
    const items: Invoice[] = [
      makeInvoice({ id: 'inv-paid', status: 'paid' }),
      makeInvoice({ id: 'inv-cancelled', status: 'cancelled' }),
    ];
    invoiceRepository.listByCustomerId.mockResolvedValue(items);

    const result = await controller.portalInvoices('biz-sn-001', 'cust-aaa-001');

    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].id).toBe('inv-paid');
  });

  it('returns empty list when customer has no visible invoices', async () => {
    const { controller, invoiceRepository } = makeController();
    invoiceRepository.listByCustomerId.mockResolvedValue([
      makeInvoice({ status: 'draft' }),
      makeInvoice({ status: 'cancelled' }),
    ]);

    const result = await controller.portalInvoices('biz-sn-001', 'cust-aaa-001');

    expect(result.data.items).toHaveLength(0);
  });

  it('passes businessId and customerId to invoiceRepository', async () => {
    const { controller, invoiceRepository } = makeController();
    invoiceRepository.listByCustomerId.mockResolvedValue([]);

    await controller.portalInvoices('biz-sn-001', 'cust-aaa-001');

    expect(invoiceRepository.listByCustomerId).toHaveBeenCalledWith('biz-sn-001', 'cust-aaa-001', 50);
  });

  it('throws BadRequestException when businessId is missing', async () => {
    const { controller } = makeController();

    await expect(controller.portalInvoices('', 'cust-aaa-001')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when customerId is missing', async () => {
    const { controller } = makeController();

    await expect(controller.portalInvoices('biz-sn-001', '')).rejects.toThrow(BadRequestException);
  });
});
