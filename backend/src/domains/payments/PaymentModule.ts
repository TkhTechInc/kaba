import { Module, Global, forwardRef } from '@nestjs/common';
import { PaymentGatewayManager } from './gateways/PaymentGatewayManager';
import { MockPaymentGateway } from './gateways/MockPaymentGateway';
import { PaymentWebhookController } from './PaymentWebhookController';
import { PaymentsClient } from './services/PaymentsClient';
import { InvoiceModule } from '@/domains/invoicing/InvoiceModule';
import { AuditModule } from '@/domains/audit/AuditModule';

export const PAYMENT_GATEWAY_MANAGER = 'PAYMENT_GATEWAY_MANAGER';
export const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY';

@Global()
@Module({
  imports: [forwardRef(() => InvoiceModule), AuditModule],
  controllers: [PaymentWebhookController],
  providers: [
    PaymentGatewayManager,
    {
      provide: PAYMENT_GATEWAY,
      useClass: MockPaymentGateway,
    },
    PaymentsClient,
  ],
  exports: [PaymentGatewayManager, PAYMENT_GATEWAY, PaymentsClient],
})
export class PaymentModule {}
