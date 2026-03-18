import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import { InvoiceShareService } from '@/domains/invoicing/services/InvoiceShareService';
import type { InvoiceItem } from '@/domains/invoicing/models/Invoice';

@Injectable()
export class SendBulkInvoicesTool implements IMcpTool {
  readonly name = 'send_bulk_invoices';
  readonly description = 'Create and send multiple invoices at once with payment links via WhatsApp or SMS';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'pro' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      invoices: {
        type: 'array',
        description: 'List of invoices to create and send',
        items: {
          type: 'object',
          properties: {
            customerId: { type: 'string', description: 'Customer ID' },
            amount: { type: 'number', description: 'Total invoice amount' },
            currency: { type: 'string', description: 'Currency code (default XOF)' },
            dueDate: { type: 'string', description: 'Due date YYYY-MM-DD' },
            description: { type: 'string', description: 'Invoice description' },
            items: {
              type: 'array',
              description: 'Line items (optional)',
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
        },
      },
      sendPaymentLink: { type: 'boolean', description: 'Send payment links via messaging (default true)' },
    },
    required: ['invoices'],
  };

  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly invoiceShareService: InvoiceShareService,
  ) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const rawInvoices = input.invoices as Record<string, unknown>[];
    const sendPaymentLink = input.sendPaymentLink !== false;

    const results = [];
    const errors = [];

    for (const rawInvoice of rawInvoices) {
      try {
        const amount = rawInvoice.amount as number;
        const currency = (rawInvoice.currency as string) ?? 'XOF';
        const description = (rawInvoice.description as string) ?? 'Invoice';

        const rawItems = rawInvoice.items as Record<string, unknown>[] | undefined;
        const items: InvoiceItem[] =
          rawItems && rawItems.length > 0
            ? rawItems.map((item) => ({
                description: (item.description as string) ?? description,
                quantity: (item.quantity as number) ?? 1,
                unitPrice: (item.unitPrice as number) ?? amount,
                amount:
                  (item.amount as number) ??
                  (item.quantity as number ?? 1) * (item.unitPrice as number ?? amount),
              }))
            : [{ description, quantity: 1, unitPrice: amount, amount }];

        const invoice = await this.invoiceService.create(
          {
            businessId: ctx.businessId,
            customerId: rawInvoice.customerId as string,
            amount,
            currency,
            dueDate:
              (rawInvoice.dueDate as string) ??
              new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            items,
            status: 'pending',
          },
          ctx.userId,
        );

        let paymentLink: string | undefined;

        if (sendPaymentLink) {
          try {
            const token = await this.invoiceShareService.generatePublicToken(
              invoice.id,
              ctx.businessId,
            );
            paymentLink = `${process.env['FRONTEND_URL']}/pay/${token}`;
          } catch (err) {
            console.error(`Failed to generate payment link for invoice ${invoice.id}:`, err);
          }
        }

        results.push({
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount: invoice.amount,
          currency: invoice.currency,
          status: invoice.status,
          paymentLink,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({
          customerId: rawInvoice.customerId,
          error: msg,
        });
      }
    }

    return {
      created: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
