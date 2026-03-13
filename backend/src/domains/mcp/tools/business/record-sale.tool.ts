import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { LedgerService } from '@/domains/ledger/services/LedgerService';

@Injectable()
export class RecordSaleTool implements IMcpTool {
  readonly name = 'record_sale';
  readonly description = 'Record a sale transaction in the ledger';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      amount: { type: 'number', description: 'Sale amount (positive number)' },
      description: { type: 'string', description: 'What was sold' },
      currency: { type: 'string', description: 'Currency code e.g. XOF, GHS, NGN (default XOF)' },
      category: { type: 'string', description: 'Category e.g. sales, services' },
    },
    required: ['amount', 'description'],
  };

  constructor(private readonly ledgerService: LedgerService) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const entry = await this.ledgerService.createEntry(
      {
        type: 'sale',
        businessId: ctx.businessId,
        amount: input.amount as number,
        description: input.description as string,
        currency: (input.currency as string) ?? 'XOF',
        category: (input.category as string) ?? 'sales',
        date: new Date().toISOString().slice(0, 10),
      },
      ctx.userId,
    );
    return entry;
  }
}
