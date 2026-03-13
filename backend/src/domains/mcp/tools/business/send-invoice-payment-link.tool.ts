import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { InvoiceShareService } from '@/domains/invoicing/services/InvoiceShareService';

@Injectable()
export class SendInvoicePaymentLinkTool implements IMcpTool {
  readonly name = 'send_invoice_payment_link';
  readonly description = 'Generate a payment link for an invoice to share with the customer';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'pro' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      invoiceId: { type: 'string', description: 'Invoice ID to generate payment link for' },
    },
    required: ['invoiceId'],
  };

  constructor(private readonly invoiceShareService: InvoiceShareService) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const result = await this.invoiceShareService.generatePublicToken(
      input.invoiceId as string,
      ctx.businessId,
    );
    return { token: result.token, payUrl: result.payUrl };
  }
}
