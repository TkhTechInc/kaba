import { Module, Global } from '@nestjs/common';
import { PaymentGatewayManager } from './gateways/PaymentGatewayManager';
import { MockPaymentGateway } from './gateways/MockPaymentGateway';
import { PaymentWebhookController } from './PaymentWebhookController';
import { InvoiceModule } from '@/domains/invoicing/InvoiceModule';

export const PAYMENT_GATEWAY_MANAGER = 'PAYMENT_GATEWAY_MANAGER';
export const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY';

@Global()
@Module({
  imports: [InvoiceModule],
  controllers: [PaymentWebhookController],
  providers: [
    PaymentGatewayManager,
    {
      provide: PAYMENT_GATEWAY,
      useClass: MockPaymentGateway,
    },
  ],
  exports: [PaymentGatewayManager, PAYMENT_GATEWAY],
})
export class PaymentModule {}
