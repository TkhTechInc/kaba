import { Module, Global, forwardRef } from '@nestjs/common';
import { PaymentsClient } from './services/PaymentsClient';
import { InvoiceModule } from '@/domains/invoicing/InvoiceModule';
import { PlanModule } from '@/domains/plans/PlanModule';
import { StorefrontModule } from '@/domains/storefront/StorefrontModule';
import { AuditModule } from '@/domains/audit/AuditModule';

/**
 * All payments go through TKH Payments (payment gateway aggregator).
 * Requires PAYMENTS_SERVICE_URL. No local gateway fallback.
 */
@Global()
@Module({
  imports: [
    forwardRef(() => InvoiceModule),
    forwardRef(() => PlanModule),
    forwardRef(() => StorefrontModule),
    AuditModule,
  ],
  controllers: [],
  providers: [PaymentsClient],
  exports: [PaymentsClient],
})
export class PaymentModule {}
