import { Controller, Inject, Optional, Param, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '@/nest/common/decorators/auth.decorator';
import { PaymentGatewayManager } from './gateways/PaymentGatewayManager';
import { PaymentGatewayType } from './interfaces/IPaymentGateway';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';

/**
 * Payment webhook controller.
 * Receives callbacks from Stripe, KkiaPay, MoMo, Paystack.
 * Raw body is captured by the middleware in main.ts for HMAC signature verification.
 */
@Controller('api/v1/payments/webhook')
@Public()
export class PaymentWebhookController {
  constructor(
    private readonly gatewayManager: PaymentGatewayManager,
    @Optional() private readonly invoiceService?: InvoiceService,
  ) {}

  @Post(':gateway')
  async handleWebhook(
    @Param('gateway') gateway: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body ?? {});

    // Each gateway expects its own specific signature header.
    const gatewayType = this.normalizeGateway(gateway);
    if (!gatewayType) {
      return res.status(400).json({ success: false, error: 'Unknown gateway' });
    }

    const signature = this.extractSignature(req, gatewayType);

    try {
      const g = this.gatewayManager.getGatewayById(gatewayType);
      if (!g.handleWebhook) {
        return res.status(200).json({ success: true });
      }

      const result = await g.handleWebhook(rawBody, signature);

      // If the webhook signals a successful payment, mark the invoice as paid.
      if (result.success && result.invoiceId && result.businessId && this.invoiceService) {
        try {
          await this.invoiceService.markPaidFromWebhook(result.businessId, result.invoiceId);
        } catch (invoiceErr) {
          // Log but don't fail the webhook response — gateway must receive 200 to stop retries.
          console.error('[PaymentWebhookController] markPaidFromWebhook failed:', invoiceErr);
        }
      }

      return res.status(200).json({ success: result.success });
    } catch {
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  private normalizeGateway(gateway: string): PaymentGatewayType | null {
    const g = gateway.toLowerCase();
    if (g === 'mock') return 'mock';
    if (g === 'stripe') return 'stripe';
    if (g === 'kkiapay') return 'kkiapay';
    if (g === 'momo' || g === 'mtmmomo' || g === 'mtn') return 'momo';
    if (g === 'paystack') return 'paystack';
    return null;
  }

  private extractSignature(req: Request, gatewayType: PaymentGatewayType): string | undefined {
    switch (gatewayType) {
      case 'stripe':
        return req.headers['stripe-signature'] as string | undefined;
      case 'kkiapay':
        return req.headers['x-kkiapay-signature'] as string | undefined;
      case 'momo':
        return req.headers['x-momo-signature'] as string | undefined;
      case 'paystack':
        return req.headers['x-paystack-signature'] as string | undefined;
      default:
        return undefined;
    }
  }
}
