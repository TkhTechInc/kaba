import { Injectable } from '@nestjs/common';
import { ProductRepository } from '../repositories/ProductRepository';
import { Product, CreateProductInput, UpdateProductInput } from '../models/Product';
import { FeatureService } from '@/domains/features/FeatureService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { ValidationError, NotFoundError } from '@/shared/errors/DomainError';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly featureService: FeatureService,
    private readonly businessRepo: BusinessRepository,
  ) {}

  async create(input: CreateProductInput): Promise<Product> {
    await this.assertFeatureEnabled(input.businessId);
    return this.productRepository.create(input);
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
    input: UpdateProductInput
  ): Promise<Product> {
    await this.assertFeatureEnabled(businessId);
    const existing = await this.productRepository.getById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Product', id);
    }

    const updated = await this.productRepository.update(businessId, id, input);
    return updated ?? existing;
  }

  async delete(businessId: string, id: string): Promise<void> {
    await this.assertFeatureEnabled(businessId);
    const existing = await this.productRepository.getById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Product', id);
    }

    await this.productRepository.delete(businessId, id);
  }

  async decrementStock(
    businessId: string,
    id: string,
    quantity: number
  ): Promise<Product | null> {
    return this.productRepository.decrementStock(businessId, id, quantity);
  }
}
