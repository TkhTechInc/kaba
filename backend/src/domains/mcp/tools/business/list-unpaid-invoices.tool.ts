import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';

@Injectable()
export class ListUnpaidInvoicesTool implements IMcpTool {
  readonly name = 'list_unpaid_invoices';
  readonly description = 'List all unpaid invoices';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {},
    required: [],
  };

  constructor(private readonly invoiceService: InvoiceService) {}

  async execute(_input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const invoices = await this.invoiceService.listUnpaid(ctx.businessId);
    return invoices.map((inv) => ({
      id: inv.id,
      amount: inv.amount,
      currency: inv.currency ?? 'XOF',
      dueDate: inv.dueDate ?? null,
      customerName: inv.customerId ?? null,
      status: inv.status,
    }));
  }
}
