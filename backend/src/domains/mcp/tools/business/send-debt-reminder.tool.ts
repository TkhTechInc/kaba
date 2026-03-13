import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { DebtService } from '@/domains/debts/services/DebtService';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';

@Injectable()
export class SendDebtReminderTool implements IMcpTool {
  readonly name = 'send_debt_reminder';
  readonly description =
    'Send a WhatsApp or SMS payment reminder to a debtor. The debtor must have a phone number on file.';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      debtorName: { type: 'string', description: 'Name of the debtor (used to find the debt)' },
      debtId: { type: 'string', description: 'Exact debt ID to send reminder for' },
    },
    required: [],
  };

  constructor(
    private readonly debtService: DebtService,
    private readonly debtRepository: DebtRepository,
  ) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const debtId = input.debtId as string | undefined;
    const debtorName = input.debtorName as string | undefined;

    try {
      if (debtId) {
        const result = await this.debtService.sendReminder(ctx.businessId, debtId);
        return { sent: result.sent, channel: result.channel, debtId };
      }

      if (debtorName) {
        const listResult = await this.debtRepository.listByBusiness(ctx.businessId, 1, 50);
        const match = listResult.items.find((d) =>
          d.debtorName.toLowerCase().includes(debtorName.toLowerCase()),
        );

        if (!match) {
          return { error: `No debt found for ${debtorName}` };
        }

        const result = await this.debtService.sendReminder(ctx.businessId, match.id);
        return { sent: result.sent, channel: result.channel, debtorName: match.debtorName };
      }

      return { error: 'Provide either debtorName or debtId' };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}
