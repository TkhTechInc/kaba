import { Module, Global } from '@nestjs/common';
import { PaymentGatewayManager } from './gateways/PaymentGatewayManager';
import { MockPaymentGateway } from './gateways/MockPaymentGateway';
import { PaymentWebhookController } from './PaymentWebhookController';

export const PAYMENT_GATEWAY_MANAGER = 'PAYMENT_GATEWAY_MANAGER';
export const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY';

@Global()
@Module({
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
