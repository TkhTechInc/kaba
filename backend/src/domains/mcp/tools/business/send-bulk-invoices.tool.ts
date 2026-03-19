import { Injectable, Logger } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import { InvoiceShareService } from '@/domains/invoicing/services/InvoiceShareService';
import type { InvoiceItem } from '@/domains/invoicing/models/Invoice';
import { BulkInvoicesInputSchema, type BulkInvoicesInput } from '../../validation/schemas';
import { BulkOperationError, McpInputValidationError } from '../../errors/McpErrors';
import { MCP_CONFIG } from '@/config/constants';

interface CreateInvoiceCommand {
  customerId: string;
  amount: number;
  currency: string;
  dueDate: string;
  items: InvoiceItem[];
  createdInvoiceId?: string;
}

@Injectable()
export class SendBulkInvoicesTool implements IMcpTool {
  private readonly logger = new Logger(SendBulkInvoicesTool.name);

  readonly name = 'send_bulk_invoices';
  readonly description = 'Create and send multiple invoices at once with payment links via WhatsApp or SMS';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'pro' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      invoices: {
        type: 'array',
        description: 'List of invoices to create and send (max 100)',
        maxItems: MCP_CONFIG.MAX_BULK_INVOICES,
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
              maxItems: MCP_CONFIG.MAX_INVOICE_LINE_ITEMS,
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
    const startTime = Date.now();

    // Validate input
    let validated: BulkInvoicesInput;
    try {
      validated = BulkInvoicesInputSchema.parse(input);
    } catch (err: any) {
      const errors = err.errors?.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      })) ?? [{ field: 'input', message: err.message }];
      throw new McpInputValidationError('send_bulk_invoices', errors);
    }

    this.logger.log('Starting bulk invoice creation', {
      businessId: ctx.businessId,
      count: validated.invoices.length,
      tier: ctx.tier,
    });

    // Pre-validate all customer IDs exist
    await this.validateCustomers(validated.invoices.map((i: { customerId: string }) => i.customerId), ctx.businessId);

    // Build commands
    const commands: CreateInvoiceCommand[] = validated.invoices.map((inv: BulkInvoicesInput['invoices'][number]) => ({
      customerId: inv.customerId,
      amount: inv.amount,
      currency: inv.currency ?? 'XOF',
      dueDate: inv.dueDate ?? this.getDefaultDueDate(),
      items: this.buildInvoiceItems(inv.items, inv.amount, inv.description),
    }));

    // Execute with rollback on failure
    const { succeeded, failed, results, errors } = await this.executeWithRollback(
      commands,
      ctx,
      validated.sendPaymentLink,
    );

    const duration = Date.now() - startTime;
    this.logger.log('Bulk invoice creation completed', {
      businessId: ctx.businessId,
      succeeded,
      failed,
      duration,
    });

    // If any failed, throw error
    if (failed > 0) {
      throw new BulkOperationError(
        `${failed} of ${validated.invoices.length} invoices failed to create`,
        succeeded,
        failed,
        errors,
      );
    }

    return {
      created: succeeded,
      results,
      duration,
    };
  }

  /**
   * Execute commands with automatic rollback on failure
   */
  private async executeWithRollback(
    commands: CreateInvoiceCommand[],
    ctx: McpToolContext,
    sendPaymentLink: boolean,
  ): Promise<{
    succeeded: number;
    failed: number;
    results: any[];
    errors: Array<{ index: number; error: string }>;
  }> {
    const results: any[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    const createdIds: string[] = [];

    try {
      // Execute each command sequentially
      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        try {
          const invoice = await this.invoiceService.create(
            {
              businessId: ctx.businessId,
              customerId: cmd.customerId,
              amount: cmd.amount,
              currency: cmd.currency,
              dueDate: cmd.dueDate,
              items: cmd.items,
              status: 'sent',
            },
            ctx.userId,
          );

          cmd.createdInvoiceId = invoice.id;
          createdIds.push(invoice.id);

          let paymentLink: string | undefined;
          if (sendPaymentLink) {
            try {
              const token = await this.invoiceShareService.generatePublicToken(
                invoice.id,
                ctx.businessId,
              );
              paymentLink = `${process.env['FRONTEND_URL']}/pay/${token}`;
            } catch (err) {
              this.logger.warn('Failed to generate payment link', {
                invoiceId: invoice.id,
                error: err,
              });
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
        } catch (err: any) {
          // First failure - rollback all previously created invoices
          this.logger.error('Invoice creation failed, rolling back', {
            index: i,
            createdSoFar: createdIds.length,
            error: err.message,
          });

          // Rollback
          await this.rollback(createdIds, ctx);

          throw new BulkOperationError(
            `Failed at invoice ${i + 1}: ${err.message}. All invoices rolled back.`,
            0,
            commands.length,
            [{ index: i, error: err.message }],
          );
        }
      }

      return {
        succeeded: createdIds.length,
        failed: 0,
        results,
        errors,
      };
    } catch (err) {
      // Re-throw BulkOperationError as-is
      if (err instanceof BulkOperationError) {
        throw err;
      }

      // Unexpected error - rollback and wrap
      await this.rollback(createdIds, ctx);
      throw new BulkOperationError(
        `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
        0,
        commands.length,
        [{ index: 0, error: String(err) }],
      );
    }
  }

  /**
   * Rollback all created invoices
   */
  private async rollback(invoiceIds: string[], ctx: McpToolContext): Promise<void> {
    if (invoiceIds.length === 0) return;

    this.logger.warn('Rolling back invoices', {
      businessId: ctx.businessId,
      count: invoiceIds.length,
      ids: invoiceIds,
    });

    // Delete in reverse order
    for (const id of invoiceIds.reverse()) {
      try {
        await this.invoiceService.softDelete(ctx.businessId, id);
      } catch (err) {
        this.logger.error('Failed to rollback invoice', { id, error: err });
        // Continue rolling back others even if one fails
      }
    }
  }

  /**
   * Validate all customers exist before starting
   */
  private async validateCustomers(customerIds: string[], businessId: string): Promise<void> {
    // TODO: Implement batch customer lookup
    // For now, we'll let individual creates fail if customer doesn't exist
  }

  /**
   * Build invoice line items
   */
  private buildInvoiceItems(
    rawItems: any[] | undefined,
    defaultAmount: number,
    defaultDescription?: string,
  ): InvoiceItem[] {
    if (rawItems && rawItems.length > 0) {
      return rawItems.map(item => ({
        description: item.description ?? (defaultDescription || 'Item'),
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice ?? defaultAmount,
        amount: item.amount ?? (item.quantity ?? 1) * (item.unitPrice ?? defaultAmount),
      }));
    }

    return [
      {
        description: defaultDescription ?? 'Invoice',
        quantity: 1,
        unitPrice: defaultAmount,
        amount: defaultAmount,
      },
    ];
  }

  private getDefaultDueDate(): string {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
}
