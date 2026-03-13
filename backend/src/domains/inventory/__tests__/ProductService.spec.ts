import { ProductService } from '../services/ProductService';
import { ProductRepository } from '../repositories/ProductRepository';
import { FeatureService } from '@/domains/features/FeatureService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { Product, CreateProductInput } from '../models/Product';
import { ValidationError } from '@/shared/errors/DomainError';
import { ConfigService } from '@nestjs/config';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-001',
    businessId: 'biz-001',
    name: 'Tissu Wax',
    unitPrice: 5000,
    currency: 'XOF',
    quantityInStock: 10,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<CreateProductInput> = {}): CreateProductInput {
  return {
    businessId: 'biz-001',
    name: 'Tissu Wax',
    unitPrice: 5000,
    currency: 'XOF',
    quantityInStock: 10,
    ...overrides,
  };
}

const STARTER_BUSINESS = {
  id: 'biz-001',
  businessId: 'biz-001',
  tier: 'starter' as const,
  currency: 'XOF',
  name: 'Marché Dantokpa',
  countryCode: 'BJ',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  onboardingComplete: true,
};

const FREE_BUSINESS = { ...STARTER_BUSINESS, tier: 'free' as const };

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeMocks() {
  const productRepository = {
    create: jest.fn(),
    getById: jest.fn(),
    listByBusiness: jest.fn(),
    listWithCursor: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    decrementStock: jest.fn(),
  } as unknown as jest.Mocked<ProductRepository>;

  const featureService = new FeatureService(null as unknown as ConfigService);

  const businessRepo = {
    getOrCreate: jest.fn().mockResolvedValue(STARTER_BUSINESS),
  } as unknown as jest.Mocked<BusinessRepository>;

  const service = new ProductService(
    productRepository,
    featureService,
    businessRepo,
    undefined, // auditLogger — optional
  );

  return { service, productRepository, businessRepo, featureService };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProductService', () => {
  describe('create', () => {
    it('creates product and returns it', async () => {
      const { service, productRepository } = makeMocks();
      const created = makeProduct();
      productRepository.create.mockResolvedValue(created);

      const result = await service.create(makeCreateInput());

      expect(productRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz-001',
          name: 'Tissu Wax',
          unitPrice: 5000,
          currency: 'XOF',
          quantityInStock: 10,
        }),
      );
      expect(result.id).toBe('prod-001');
      expect(result.businessId).toBe('biz-001');
      expect(result.name).toBe('Tissu Wax');
    });

    it('throws ValidationError when inventory feature is not enabled', async () => {
      const { service, businessRepo } = makeMocks();
      (businessRepo.getOrCreate as jest.Mock).mockResolvedValue({ ...FREE_BUSINESS, tier: 'free' });

      await expect(service.create(makeCreateInput())).rejects.toThrow(ValidationError);
    });

    it('succeeds when tier has inventory_lite (starter)', async () => {
      const { service, productRepository, businessRepo } = makeMocks();
      (businessRepo.getOrCreate as jest.Mock).mockResolvedValue({ ...FREE_BUSINESS, tier: 'starter' });
      const created = makeProduct();
      productRepository.create.mockResolvedValue(created);

      const result = await service.create(makeCreateInput());

      expect(result.id).toBe('prod-001');
    });
  });

  describe('list', () => {
    it('delegates to repository with correct args', async () => {
      const { service, productRepository } = makeMocks();
      const mockResult = {
        items: [makeProduct(), makeProduct({ id: 'prod-002', name: 'Pagne' })],
        total: 2,
        page: 1,
        limit: 50,
      };
      productRepository.listByBusiness.mockResolvedValue(mockResult);

      const result = await service.list('biz-001', 1, 50);

      expect(productRepository.listByBusiness).toHaveBeenCalledWith('biz-001', 1, 50, undefined);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('passes exclusiveStartKey when provided', async () => {
      const { service, productRepository } = makeMocks();
      const cursor = { pk: 'biz-001', sk: 'PRODUCT#prod-001' };
      productRepository.listByBusiness.mockResolvedValue({ items: [], total: 0, page: 2, limit: 50 });

      await service.list('biz-001', 2, 50, cursor);

      expect(productRepository.listByBusiness).toHaveBeenCalledWith('biz-001', 2, 50, cursor);
    });

    it('throws ValidationError when inventory feature is not enabled', async () => {
      const { service, businessRepo } = makeMocks();
      (businessRepo.getOrCreate as jest.Mock).mockResolvedValue({ ...FREE_BUSINESS, tier: 'free' });

      await expect(service.list('biz-001')).rejects.toThrow(ValidationError);
    });
  });

  describe('getById', () => {
    it('returns product when found', async () => {
      const { service, productRepository } = makeMocks();
      const product = makeProduct();
      productRepository.getById.mockResolvedValue(product);

      const result = await service.getById('biz-001', 'prod-001');

      expect(productRepository.getById).toHaveBeenCalledWith('biz-001', 'prod-001');
      expect(result?.id).toBe('prod-001');
      expect(result?.name).toBe('Tissu Wax');
    });

    it('returns null when product not found', async () => {
      const { service, productRepository } = makeMocks();
      productRepository.getById.mockResolvedValue(null);

      const result = await service.getById('biz-001', 'prod-missing');

      expect(result).toBeNull();
    });

    it('throws ValidationError when inventory feature is not enabled', async () => {
      const { service, businessRepo } = makeMocks();
      (businessRepo.getOrCreate as jest.Mock).mockResolvedValue({ ...FREE_BUSINESS, tier: 'free' });

      await expect(service.getById('biz-001', 'prod-001')).rejects.toThrow(ValidationError);
    });
  });
});
