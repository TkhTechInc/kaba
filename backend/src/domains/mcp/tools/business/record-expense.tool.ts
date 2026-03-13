import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { LedgerService } from '@/domains/ledger/services/LedgerService';

@Injectable()
export class RecordExpenseTool implements IMcpTool {
  readonly name = 'record_expense';
  readonly description = 'Record an expense transaction in the ledger';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      amount: { type: 'number', description: 'Expense amount (positive number)' },
      description: { type: 'string', description: 'What was purchased or paid for' },
      currency: { type: 'string', description: 'Currency code e.g. XOF, GHS, NGN (default XOF)' },
      category: { type: 'string', description: 'Category e.g. transport, supplies, rent' },
    },
    required: ['amount', 'description'],
  };

  constructor(private readonly ledgerService: LedgerService) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const entry = await this.ledgerService.createEntry(
      {
        type: 'expense',
        businessId: ctx.businessId,
        amount: input.amount as number,
        description: input.description as string,
        currency: (input.currency as string) ?? 'XOF',
        category: (input.category as string) ?? 'expenses',
        date: new Date().toISOString().slice(0, 10),
      },
      ctx.userId,
    );
    return entry;
  }
}
