import { Injectable } from '@nestjs/common';
import { SupplierRepository } from '../repositories/SupplierRepository';
import { Supplier } from '../models/Supplier';
import { NotFoundError } from '@/shared/errors/DomainError';
import type { CreateSupplierDto } from '../dto/create-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(private readonly supplierRepo: SupplierRepository) {}

  async create(businessId: string, data: CreateSupplierDto): Promise<Supplier> {
    return this.supplierRepo.create({ businessId, ...data });
  }

  async list(businessId: string): Promise<{ items: Supplier[] }> {
    const items = await this.supplierRepo.listByBusiness(businessId);
    return { items };
  }

  async getById(businessId: string, id: string): Promise<Supplier> {
    const supplier = await this.supplierRepo.findById(businessId, id);
    if (!supplier) throw new NotFoundError('Supplier', id);
    return supplier;
  }

  async update(businessId: string, id: string, data: Partial<CreateSupplierDto>): Promise<Supplier> {
    const existing = await this.supplierRepo.findById(businessId, id);
    if (!existing) throw new NotFoundError('Supplier', id);
    return this.supplierRepo.update({ ...existing, ...data });
  }

  async delete(businessId: string, id: string): Promise<void> {
    const existing = await this.supplierRepo.findById(businessId, id);
    if (!existing) throw new NotFoundError('Supplier', id);
    return this.supplierRepo.delete(businessId, id);
  }
}
