import { Inject, Optional } from '@nestjs/common';
import { CustomerRepository, ListByBusinessResult } from '../repositories/CustomerRepository';
import { Customer, CreateCustomerInput, UpdateCustomerInput } from '../models/Customer';
import { NotFoundError, ValidationError } from '@/shared/errors/DomainError';
import { IAuditLogger } from '../../audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '../../audit/AuditModule';

export class CustomerService {
  constructor(
    private readonly customerRepository: CustomerRepository,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
  ) {}

  async create(input: CreateCustomerInput): Promise<Customer> {
    if (!input.businessId?.trim()) {
      throw new ValidationError('businessId is required');
    }
    if (!input.name?.trim()) {
      throw new ValidationError('name is required');
    }
    if (!input.email?.trim()) {
      throw new ValidationError('email is required');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      throw new ValidationError('email must be a valid email address');
    }

    return this.customerRepository.create(input);
  }

  async list(
    businessId: string,
    page: number = 1,
    limit: number = 20,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<ListByBusinessResult> {
    if (!businessId?.trim()) {
      throw new ValidationError('businessId is required');
    }

    return this.customerRepository.listByBusiness(businessId, page, limit, exclusiveStartKey);
  }

  async getById(businessId: string, id: string): Promise<Customer> {
    const customer = await this.customerRepository.getById(businessId, id);
    if (!customer) {
      throw new NotFoundError('Customer', id);
    }
    return customer;
  }

  async update(
    businessId: string,
    id: string,
    input: UpdateCustomerInput,
    userId?: string,
  ): Promise<Customer> {
    const existing = await this.customerRepository.getById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Customer', id);
    }

    if (input.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input.email)) {
        throw new ValidationError('email must be a valid email address');
      }
    }

    const updated = await this.customerRepository.update(businessId, id, input);
    if (!updated) {
      throw new NotFoundError('Customer', id);
    }

    if (this.auditLogger && userId) {
      const changes: Record<string, { from?: unknown; to?: unknown }> = {};
      if (input.name !== undefined) changes['name'] = { from: existing.name, to: input.name };
      if (input.email !== undefined) changes['email'] = { from: existing.email, to: input.email };
      if (input.phone !== undefined) changes['phone'] = { from: existing.phone, to: input.phone };
      await this.auditLogger.log({
        entityType: 'Customer',
        entityId: id,
        businessId,
        action: 'update',
        userId,
        changes: Object.keys(changes).length > 0 ? changes : undefined,
      });
    }

    return updated;
  }

  async delete(businessId: string, id: string, userId?: string): Promise<void> {
    const existing = await this.customerRepository.getById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Customer', id);
    }

    await this.customerRepository.delete(businessId, id);

    if (this.auditLogger && userId) {
      await this.auditLogger.log({
        entityType: 'Customer',
        entityId: id,
        businessId,
        action: 'delete',
        userId,
        changes: {
          name: { from: existing.name, to: null },
          email: { from: existing.email, to: null },
        },
      });
    }
  }
}
