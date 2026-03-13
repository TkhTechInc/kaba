import { Injectable } from '@nestjs/common';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import { CustomerRepository } from '@/domains/invoicing/repositories/CustomerRepository';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';

@Injectable()
export class LookupMyInvoicesTool implements IMcpTool {
  readonly name = 'lookup_my_invoices';
  readonly description = 'Look up all invoices for the customer by their email address';
  readonly scopes = ['customer'] as const;
  readonly tierRequired = 'free' as const;
  readonly inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      fromDate: { type: 'string', description: 'Start date YYYY-MM-DD' },
      toDate: { type: 'string', description: 'End date YYYY-MM-DD' },
    },
    required: [],
  };

  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly customerRepository: CustomerRepository,
  ) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const fromDate = input['fromDate'] as string | undefined;
    const toDate = input['toDate'] as string | undefined;
    const result = await this.invoiceService.list(ctx.businessId, 1, 20, undefined, fromDate, toDate);

    if (!ctx.customerEmail) {
      return result.items.map(this.toSummary);
    }

    const customer = await this.customerRepository.findByEmail(ctx.businessId, ctx.customerEmail);
    const items = customer
      ? result.items.filter((inv) => inv.customerId === customer.id)
      : [];
    return items.map(this.toSummary);
  }

  private toSummary(invoice: { id: string; amount: number; currency: string; dueDate: string; status: string; items: Array<{ description: string }> }) {
    return {
      id: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      status: invoice.status,
      description: invoice.items[0]?.description ?? '',
    };
  }
}
