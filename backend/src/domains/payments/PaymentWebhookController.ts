import { Controller, Param, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '@/nest/common/decorators/auth.decorator';
import { PaymentGatewayManager } from './gateways/PaymentGatewayManager';
import { PaymentGatewayType } from './interfaces/IPaymentGateway';

/**
 * Payment webhook controller.
 * Receives callbacks from Paystack, Flutterwave, etc.
 * Uses raw body for signature verification (ensure rawBody: true in main.ts).
 */
@Controller('api/v1/payments/webhook')
@Public()
export class PaymentWebhookController {
  constructor(private readonly gatewayManager: PaymentGatewayManager) {}

  @Post(':gateway')
  async handleWebhook(
    @Param('gateway') gateway: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body ?? {});
    const signature = req.headers['x-stripe-signature'] as string
      ?? req.headers['x-kkiapay-signature'] as string
      ?? req.headers['x-momo-signature'] as string
      ?? req.headers['x-paystack-signature'] as string
      ?? req.headers['verif-hash'] as string
      ?? undefined;

    const gatewayType = this.normalizeGateway(gateway);
    if (!gatewayType) {
      return res.status(400).json({ success: false, error: 'Unknown gateway' });
    }

    try {
      const g = this.gatewayManager.getGatewayById(gatewayType);
      if (g.handleWebhook) {
        const result = await g.handleWebhook(rawBody, signature);
        return res.status(200).json(result);
      }
      return res.status(200).json({ success: true });
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
    return null;
  }
}
