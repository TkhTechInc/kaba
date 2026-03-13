import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { LedgerService } from '@/domains/ledger/services/LedgerService';

@Injectable()
export class ListRecentTransactionsTool implements IMcpTool {
  readonly name = 'list_recent_transactions';
  readonly description = 'List recent sales and expense transactions';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['sale', 'expense'], description: 'Filter by transaction type' },
      limit: { type: 'number', description: 'Max results (default 10, max 20)' },
    },
    required: [],
  };

  constructor(private readonly ledgerService: LedgerService) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const limit = Math.min((input.limit as number) ?? 10, 20);
    const type = input.type as 'sale' | 'expense' | undefined;
    const result = await this.ledgerService.listWithCursor(ctx.businessId, limit, undefined, type);
    return result.items;
  }
}
