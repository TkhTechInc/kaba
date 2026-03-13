import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { DebtService } from '@/domains/debts/services/DebtService';

@Injectable()
export class AddDebtTool implements IMcpTool {
  readonly name = 'add_debt';
  readonly description = 'Record that a customer owes money to the business (a debt / créance)';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      debtorName: { type: 'string', description: 'Name of the person or business that owes money' },
      amount: { type: 'number', description: 'Amount owed' },
      currency: { type: 'string', description: 'Currency code e.g. XOF, NGN, GHS (default XOF)' },
      dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
      phone: { type: 'string', description: 'Phone number of the debtor (optional, for reminders)' },
      notes: { type: 'string', description: 'Additional notes (optional)' },
    },
    required: ['debtorName', 'amount', 'dueDate'],
  };

  constructor(private readonly debtService: DebtService) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const { debtorName, amount, dueDate, phone, notes } = input;
    const currency = (input.currency as string) ?? 'XOF';

    const debt = await this.debtService.create(
      {
        businessId: ctx.businessId,
        debtorName: debtorName as string,
        amount: amount as number,
        currency,
        dueDate: dueDate as string,
        phone: phone as string | undefined,
        notes: notes as string | undefined,
      },
      ctx.userId,
    );

    return {
      id: debt.id,
      debtorName: debt.debtorName,
      amount: debt.amount,
      currency: debt.currency,
      dueDate: debt.dueDate,
    };
  }
}
