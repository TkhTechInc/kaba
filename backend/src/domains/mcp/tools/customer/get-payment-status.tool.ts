import { Injectable } from '@nestjs/common';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import { CustomerRepository } from '@/domains/invoicing/repositories/CustomerRepository';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';

@Injectable()
export class GetPaymentStatusTool implements IMcpTool {
  readonly name = 'get_payment_status';
  readonly description = 'Check the payment status of an invoice';
  readonly scopes = ['customer'] as const;
  readonly tierRequired = 'free' as const;
  readonly inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      invoiceId: { type: 'string', description: 'Invoice ID to check' },
    },
    required: ['invoiceId'],
  };

  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly customerRepository: CustomerRepository,
  ) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const invoice = await this.invoiceService.getById(ctx.businessId, input['invoiceId'] as string);

    if (ctx.customerEmail) {
      const customer = await this.customerRepository.findByEmail(ctx.businessId, ctx.customerEmail);
      if (!customer || invoice.customerId !== customer.id) {
        throw new Error('Invoice not found');
      }
    }

    return {
      invoiceId: invoice.id,
      status: invoice.status,
      amount: invoice.amount,
      currency: invoice.currency,
      paidAt: (invoice as unknown as Record<string, unknown>)['paidAt'] ?? null,
    };
  }
}
