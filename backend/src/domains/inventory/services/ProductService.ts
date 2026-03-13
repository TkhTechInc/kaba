import { Injectable, Inject, Optional } from '@nestjs/common';
import { ProductRepository } from '../repositories/ProductRepository';
import { Product, CreateProductInput, UpdateProductInput } from '../models/Product';
import { FeatureService } from '@/domains/features/FeatureService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { ValidationError, NotFoundError } from '@/shared/errors/DomainError';
import { IAuditLogger } from '@/domains/audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '@/domains/audit/AuditModule';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly featureService: FeatureService,
    private readonly businessRepo: BusinessRepository,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
  ) {}

  async create(input: CreateProductInput, userId?: string): Promise<Product> {
    await this.assertFeatureEnabled(input.businessId);
    const product = await this.productRepository.create(input);

    if (this.auditLogger && userId) {
      this.auditLogger.log({
        entityType: 'product',
        entityId: product.id,
        businessId: product.businessId,
        action: 'create',
        userId,
      }).catch(() => {});
    }

    return product;
  }

  private async assertFeatureEnabled(businessId: string): Promise<void> {
    const business = await this.businessRepo.getOrCreate(businessId, 'free');
    if (!this.featureService.isEnabled('inventory_lite', business.tier)) {
      throw new ValidationError('Inventory feature is not available for your plan');
    }
  }

  async getById(businessId: string, id: string): Promise<Product | null> {
    await this.assertFeatureEnabled(businessId);
    return this.productRepository.getById(businessId, id);
  }

  async list(
    businessId: string,
    page: number = 1,
    limit: number = 50,
    exclusiveStartKey?: Record<string, unknown>
  ) {
    await this.assertFeatureEnabled(businessId);
    return this.productRepository.listByBusiness(businessId, page, limit, exclusiveStartKey);
  }

  async update(
    businessId: string,
    id: string,
    input: UpdateProductInput,
    userId?: string,
  ): Promise<Product> {
    await this.assertFeatureEnabled(businessId);
    const existing = await this.productRepository.getById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Product', id);
    }

    const updated = await this.productRepository.update(businessId, id, input);
    const result = updated ?? existing;

    if (this.auditLogger && userId) {
      this.auditLogger.log({
        entityType: 'product',
        entityId: id,
        businessId,
        action: 'update',
        userId,
      }).catch(() => {});
    }

    return result;
  }

  async delete(businessId: string, id: string, userId?: string): Promise<void> {
    await this.assertFeatureEnabled(businessId);
    const existing = await this.productRepository.getById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Product', id);
    }

    await this.productRepository.delete(businessId, id);

    if (this.auditLogger && userId) {
      this.auditLogger.log({
        entityType: 'product',
        entityId: id,
        businessId,
        action: 'delete',
        userId,
      }).catch(() => {});
    }
  }

  async decrementStock(
    businessId: string,
    id: string,
    quantity: number
  ): Promise<Product | null> {
    return this.productRepository.decrementStock(businessId, id, quantity);
  }

  async listWithCursor(
    businessId: string,
    limit: number = 50,
    cursor?: string,
  ) {
    await this.assertFeatureEnabled(businessId);
    return this.productRepository.listWithCursor(businessId, limit, cursor);
  }
}
