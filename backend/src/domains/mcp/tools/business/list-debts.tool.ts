import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';
import type { Debt } from '@/domains/debts/models/Debt';

@Injectable()
export class ListDebtsTool implements IMcpTool {
  readonly name = 'list_debts';
  readonly description = 'List outstanding debts owed to or by the business';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['pending', 'overdue', 'paid'], description: 'Filter by status' },
    },
    required: [],
  };

  constructor(private readonly debtRepository: DebtRepository) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const status = input.status as Debt['status'] | undefined;
    const result = await this.debtRepository.listByBusiness(ctx.businessId, 1, 20, status);
    return result.items.map((debt) => ({
      id: debt.id,
      debtorName: debt.debtorName,
      amount: debt.amount,
      currency: debt.currency,
      dueDate: debt.dueDate,
      status: debt.status,
    }));
  }
}
