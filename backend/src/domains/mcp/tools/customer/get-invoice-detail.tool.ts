import { Injectable } from '@nestjs/common';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import { CustomerRepository } from '@/domains/invoicing/repositories/CustomerRepository';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';

@Injectable()
export class GetInvoiceDetailTool implements IMcpTool {
  readonly name = 'get_invoice_detail';
  readonly description = 'Get detailed information about a specific invoice';
  readonly scopes = ['customer'] as const;
  readonly tierRequired = 'free' as const;
  readonly inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      invoiceId: { type: 'string', description: 'Invoice ID' },
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
      id: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      status: invoice.status,
      description: invoice.items[0]?.description ?? '',
      items: invoice.items,
      createdAt: invoice.createdAt,
    };
  }
}
