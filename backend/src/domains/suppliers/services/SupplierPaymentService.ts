import { Injectable } from '@nestjs/common';
import { SupplierRepository } from '../repositories/SupplierRepository';
import { LedgerService } from '@/domains/ledger/services/LedgerService';
import { PaymentsClient } from '@/domains/payments/services/PaymentsClient';
import { NotFoundError } from '@/shared/errors/DomainError';

@Injectable()
export class SupplierPaymentService {
  constructor(
    private readonly supplierRepo: SupplierRepository,
    private readonly ledgerService: LedgerService,
    private readonly paymentsClient: PaymentsClient,
  ) {}

  async paySupplier(
    businessId: string,
    supplierId: string,
    amount: number,
    currency: string,
    description?: string,
  ): Promise<{ success: boolean; ledgerEntryId: string }> {
    const supplier = await this.supplierRepo.findById(businessId, supplierId);
    if (!supplier) throw new NotFoundError('Supplier', supplierId);

    const entry = await this.ledgerService.createEntry({
      businessId,
      type: 'expense',
      amount,
      currency,
      description: description ?? `Payment to supplier ${supplier.name}`,
      category: 'supplier_payment',
      date: new Date().toISOString().split('T')[0],
      supplierId,
    });

    const momoPhone = supplier.momoPhone ?? supplier.phone;
    if (momoPhone?.trim()) {
      const externalId = `qb-${businessId}-${supplierId}-${entry.id}`;
      const result = await this.paymentsClient.disburse({
        phone: momoPhone,
        amount,
        currency,
        externalId,
      });
      if (!result.success && result.error) {
        console.warn(`[SupplierPaymentService] MoMo disbursement failed for supplier ${supplierId}: ${result.error}`);
      }
    }

    return { success: true, ledgerEntryId: entry.id };
  }
}
