import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { LedgerService } from '@/domains/ledger/services/LedgerService';

@Injectable()
export class GetBalanceTool implements IMcpTool {
  readonly name = 'get_balance';
  readonly description = 'Get the current account balance for the business';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {},
    required: [],
  };

  constructor(private readonly ledgerService: LedgerService) {}

  async execute(_input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const balance = await this.ledgerService.getBalance(ctx.businessId);
    return { balance: balance.balance, currency: balance.currency };
  }
}
