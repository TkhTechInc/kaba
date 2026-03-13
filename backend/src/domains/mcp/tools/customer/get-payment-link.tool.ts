import { Injectable } from '@nestjs/common';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import { InvoiceShareService } from '@/domains/invoicing/services/InvoiceShareService';
import { CustomerRepository } from '@/domains/invoicing/repositories/CustomerRepository';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';

@Injectable()
export class GetPaymentLinkTool implements IMcpTool {
  readonly name = 'get_payment_link';
  readonly description = 'Generate a payment link for an invoice so the customer can pay it';
  readonly scopes = ['customer'] as const;
  readonly tierRequired = 'free' as const;
  readonly inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      invoiceId: { type: 'string', description: 'Invoice ID to pay' },
    },
    required: ['invoiceId'],
  };

  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly invoiceShareService: InvoiceShareService,
    private readonly customerRepository: CustomerRepository,
  ) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const invoiceId = input['invoiceId'] as string;
    const invoice = await this.invoiceService.getById(ctx.businessId, invoiceId);

    if (ctx.customerEmail) {
      const customer = await this.customerRepository.findByEmail(ctx.businessId, ctx.customerEmail);
      if (!customer || invoice.customerId !== customer.id) {
        throw new Error('Invoice not found');
      }
    }

    const { payUrl } = await this.invoiceShareService.generatePublicToken(invoiceId, ctx.businessId);
    return { payUrl, expiresIn: '7 days' };
  }
}
