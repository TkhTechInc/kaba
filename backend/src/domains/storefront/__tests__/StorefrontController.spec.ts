/**
 * Tests for the Merchant Storefront (Feature 4).
 * Public endpoints — no auth required.
 *
 * GET  /api/v1/storefront/:slug  → get public business profile
 * POST /api/v1/storefront/:slug/pay → initiate a payment from the storefront
 */
import { StorefrontController } from '../StorefrontController';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { BusinessRepository } from '@/domains/business/BusinessRepository';
import type { PaymentsClient } from '@/domains/payments/services/PaymentsClient';
import type { StorefrontPaymentService } from '../StorefrontPaymentService';
import type { Business } from '@/domains/ledger/models/Business';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: 'biz-sn-001',
    name: 'Mama Fashion',
    currency: 'XOF',
    countryCode: 'SN',
    slug: 'mama-fashion',
    description: 'Boutique mode africaine à Dakar',
    logoUrl: 'https://example.com/logo.png',
    tier: 'starter',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    onboardingComplete: true,
    ...overrides,
  };
}

function makePaymentsClient(): jest.Mocked<Pick<PaymentsClient, 'createIntent' | 'getPayConfig'>> {
  return {
    createIntent: jest.fn(),
    getPayConfig: jest.fn().mockResolvedValue({ useKkiaPayWidget: false, useMomoRequest: false }),
  } as unknown as jest.Mocked<Pick<PaymentsClient, 'createIntent' | 'getPayConfig'>>;
}

function makeStorefrontPaymentService(): jest.Mocked<Pick<StorefrontPaymentService, 'createCheckout'>> {
  return {
    createCheckout: jest.fn(),
  } as unknown as jest.Mocked<Pick<StorefrontPaymentService, 'createCheckout'>>;
}

function makeBusinessRepo(): jest.Mocked<BusinessRepository> {
  return {
    getBySlug: jest.fn(),
    getOrCreate: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<BusinessRepository>;
}

function makeConfigService() {
  return { get: jest.fn().mockReturnValue('http://localhost:3000') } as any;
}

function makeController() {
  const businessRepo = makeBusinessRepo();
  const paymentsClient = makePaymentsClient();
  const storefrontPaymentService = makeStorefrontPaymentService();
  const configService = makeConfigService();
  const controller = new StorefrontController(
    businessRepo as unknown as BusinessRepository,
    paymentsClient as unknown as PaymentsClient,
    storefrontPaymentService as unknown as StorefrontPaymentService,
    configService,
  );
  return { controller, businessRepo, paymentsClient, storefrontPaymentService, configService };
}

// ── getStorefront tests ───────────────────────────────────────────────────────

describe('StorefrontController.getStorefront', () => {
  it('returns public business profile by slug', async () => {
    const { controller, businessRepo } = makeController();
    businessRepo.getBySlug.mockResolvedValue(makeBusiness());

    const result = await controller.getStorefront('mama-fashion');

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Mama Fashion');
    expect(result.data.currency).toBe('XOF');
    expect(result.data.countryCode).toBe('SN');
    expect(result.data.description).toBe('Boutique mode africaine à Dakar');
    expect(result.data.logoUrl).toBe('https://example.com/logo.png');
  });

  it('does not expose sensitive fields like businessId or tier', async () => {
    const { controller, businessRepo } = makeController();
    businessRepo.getBySlug.mockResolvedValue(makeBusiness());

    const result = await controller.getStorefront('mama-fashion');

    expect((result.data as Record<string, unknown>).id).toBeUndefined();
    expect((result.data as Record<string, unknown>).tier).toBeUndefined();
  });

  it('throws NotFoundException when slug does not exist', async () => {
    const { controller, businessRepo } = makeController();
    businessRepo.getBySlug.mockResolvedValue(null);

    await expect(controller.getStorefront('ghost-shop')).rejects.toThrow(NotFoundException);
  });

  it('passes the slug to businessRepo.getBySlug', async () => {
    const { controller, businessRepo } = makeController();
    businessRepo.getBySlug.mockResolvedValue(makeBusiness());

    await controller.getStorefront('mama-fashion');

    expect(businessRepo.getBySlug).toHaveBeenCalledWith('mama-fashion');
  });
});

// ── initiatePayment tests ─────────────────────────────────────────────────────

describe('StorefrontController.initiatePayment', () => {
  it('returns paymentUrl when payment intent is created successfully', async () => {
    const { controller, businessRepo, paymentsClient } = makeController();
    businessRepo.getBySlug.mockResolvedValue(makeBusiness());
    paymentsClient.getPayConfig!.mockResolvedValue({ useKkiaPayWidget: false, useMomoRequest: false });
    paymentsClient.createIntent.mockResolvedValue({
      success: true,
      paymentUrl: 'https://pay.example.com/intent-abc',
      intentId: 'intent-abc',
    });

    const result = await controller.initiatePayment('mama-fashion', {
      amount: 25000,
      currency: 'XOF',
      description: 'Robe wax',
      customerName: 'Fatima Traoré',
      customerEmail: 'fatima@example.sn',
    });

    expect(result.success).toBe(true);
    expect(result.data.paymentUrl).toBe('https://pay.example.com/intent-abc');
    expect(result.data.intentId).toBe('intent-abc');
  });

  it('uses business currency as default when currency not provided in body', async () => {
    const { controller, businessRepo, paymentsClient } = makeController();
    businessRepo.getBySlug.mockResolvedValue(makeBusiness({ currency: 'XOF' }));
    paymentsClient.getPayConfig!.mockResolvedValue({ useKkiaPayWidget: false, useMomoRequest: false });
    paymentsClient.createIntent.mockResolvedValue({
      success: true,
      paymentUrl: 'https://pay.example.com/x',
      intentId: 'x',
    });

    await controller.initiatePayment('mama-fashion', { amount: 15000 });

    const callArg = paymentsClient.createIntent.mock.calls[0][0];
    expect(callArg.currency).toBe('XOF');
  });

  it('falls back to XOF when neither body nor business has currency', async () => {
    const { controller, businessRepo, paymentsClient } = makeController();
    businessRepo.getBySlug.mockResolvedValue(makeBusiness({ currency: undefined }));
    paymentsClient.getPayConfig!.mockResolvedValue({ useKkiaPayWidget: false, useMomoRequest: false });
    paymentsClient.createIntent.mockResolvedValue({
      success: true,
      paymentUrl: 'https://pay.example.com/y',
      intentId: 'y',
    });

    await controller.initiatePayment('mama-fashion', { amount: 5000 });

    const callArg = paymentsClient.createIntent.mock.calls[0][0];
    expect(callArg.currency).toBe('XOF');
  });

  it('passes businessId and metadata to paymentsClient', async () => {
    const { controller, businessRepo, paymentsClient } = makeController();
    businessRepo.getBySlug.mockResolvedValue(makeBusiness({ id: 'biz-sn-001' }));
    paymentsClient.getPayConfig!.mockResolvedValue({ useKkiaPayWidget: false, useMomoRequest: false });
    paymentsClient.createIntent.mockResolvedValue({
      success: true,
      paymentUrl: 'https://pay.example.com/z',
      intentId: 'z',
    });

    await controller.initiatePayment('mama-fashion', {
      amount: 30000,
      customerEmail: 'test@example.com',
      customerName: 'Test Customer',
      description: 'Payment for goods',
    });

    const callArg = paymentsClient.createIntent.mock.calls[0][0];
    expect(callArg.metadata.businessId).toBe('biz-sn-001');
    expect(callArg.metadata.customerEmail).toBe('test@example.com');
    expect(callArg.metadata.customerName).toBe('Test Customer');
    expect(callArg.metadata.description).toBe('Payment for goods');
    expect(callArg.metadata.appId).toBe('kaba');
  });

  it('throws NotFoundException when slug does not exist', async () => {
    const { controller, businessRepo } = makeController();
    businessRepo.getBySlug.mockResolvedValue(null);

    await expect(
      controller.initiatePayment('ghost-shop', { amount: 10000 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when amount is 0', async () => {
    const { controller, businessRepo } = makeController();
    businessRepo.getBySlug.mockResolvedValue(makeBusiness());

    await expect(
      controller.initiatePayment('mama-fashion', { amount: 0 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when amount is negative', async () => {
    const { controller, businessRepo } = makeController();
    businessRepo.getBySlug.mockResolvedValue(makeBusiness());

    await expect(
      controller.initiatePayment('mama-fashion', { amount: -500 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when payment gateway returns failure', async () => {
    const { controller, businessRepo, paymentsClient } = makeController();
    businessRepo.getBySlug.mockResolvedValue(makeBusiness());
    paymentsClient.getPayConfig!.mockResolvedValue({ useKkiaPayWidget: false, useMomoRequest: false });
    paymentsClient.createIntent.mockResolvedValue({
      success: false,
      error: 'Gateway unavailable',
    });

    await expect(
      controller.initiatePayment('mama-fashion', { amount: 10000 }),
    ).rejects.toThrow(BadRequestException);
  });
});
