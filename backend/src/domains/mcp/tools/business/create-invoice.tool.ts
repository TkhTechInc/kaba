import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import type { InvoiceItem } from '@/domains/invoicing/models/Invoice';

@Injectable()
export class CreateInvoiceTool implements IMcpTool {
  readonly name = 'create_invoice';
  readonly description = 'Create a new invoice for a customer';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer ID' },
      amount: { type: 'number', description: 'Total invoice amount' },
      currency: { type: 'string', description: 'Currency code e.g. XOF, GHS, NGN (default XOF)' },
      dueDate: { type: 'string', description: 'Due date YYYY-MM-DD' },
      description: { type: 'string', description: 'Invoice description' },
      items: {
        type: 'array',
        description: 'Line items',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: 'number' },
            unitPrice: { type: 'number' },
            amount: { type: 'number' },
          },
        },
      },
    },
    required: ['customerId', 'amount'],
  };

  constructor(private readonly invoiceService: InvoiceService) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const amount = input.amount as number;
    const currency = (input.currency as string) ?? 'XOF';
    const description = (input.description as string) ?? 'Invoice';

    const rawItems = input.items as Record<string, unknown>[] | undefined;
    const items: InvoiceItem[] = rawItems && rawItems.length > 0
      ? rawItems.map((item) => ({
          description: (item.description as string) ?? description,
          quantity: (item.quantity as number) ?? 1,
          unitPrice: (item.unitPrice as number) ?? amount,
          amount: (item.amount as number) ?? ((item.quantity as number ?? 1) * (item.unitPrice as number ?? amount)),
        }))
      : [{ description, quantity: 1, unitPrice: amount, amount }];

    const invoice = await this.invoiceService.create(
      {
        businessId: ctx.businessId,
        customerId: input.customerId as string,
        amount,
        currency,
        dueDate: (input.dueDate as string) ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        items,
        status: 'draft',
      },
      ctx.userId,
    );

    return { id: invoice.id, amount: invoice.amount, currency: invoice.currency, status: invoice.status };
  }
}
