import { Injectable } from '@nestjs/common';
import { DebtService } from '@/domains/debts/services/DebtService';
import { ReportService } from '@/domains/reports/ReportService';
import { LedgerService } from '@/domains/ledger/services/LedgerService';
import { SmsService } from '@/domains/notifications/SmsService';
import { AccessService } from '@/domains/access/AccessService';
import type { Debt } from '@/domains/debts/models/Debt';

export type VoiceCommandIntent =
  | 'top_debtors'
  | 'today_revenue'
  | 'balance'
  | 'unknown';

@Injectable()
export class VoiceCommandService {
  constructor(
    private readonly debtService: DebtService,
    private readonly reportService: ReportService,
    private readonly ledgerService: LedgerService,
    private readonly smsService: SmsService,
    private readonly accessService: AccessService,
  ) {}

  parseIntent(text: string): VoiceCommandIntent {
    const lower = text.toLowerCase().trim();
    if (
      /top\s*(3|three)?\s*debtor|debtor|who owe|owe me/i.test(lower) ||
      /kaba.*debtor/i.test(lower)
    ) {
      return 'top_debtors';
    }
    if (
      /today.*revenue|revenue today|sales today|today.*sales/i.test(lower) ||
      /kaba.*revenue/i.test(lower)
    ) {
      return 'today_revenue';
    }
    if (
      /balance|how much|current balance/i.test(lower) ||
      /kaba.*balance/i.test(lower)
    ) {
      return 'balance';
    }
    return 'unknown';
  }

  async executeCommand(
    businessId: string,
    intent: VoiceCommandIntent,
  ): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);

    switch (intent) {
      case 'top_debtors': {
        const debts = await this.debtService.list(businessId, 1, 3, 'pending');
        const top = debts.items
          .slice(0, 3)
          .map((d: Debt) => `${d.debtorName}: ${d.currency} ${d.amount.toLocaleString()}`)
          .join('; ');
        return top.length > 0
          ? `Top 3 debtors: ${top}`
          : 'No outstanding debts.';
      }
      case 'today_revenue': {
        const pl = await this.reportService.getPL(businessId, today, today);
        const revenue = pl.totalIncome ?? 0;
        const currency = pl.currency ?? 'NGN';
        return `Today revenue: ${currency} ${revenue.toLocaleString()}`;
      }
      case 'balance': {
        const balance = await this.ledgerService.getBalance(businessId);
        return `Balance: ${balance.currency} ${balance.balance.toLocaleString()}`;
      }
      default:
        return 'Supported commands: "top 3 debtors", "today revenue", "balance"';
    }
  }

  async processAndSend(
    businessId: string,
    userId: string,
    phone: string,
    text: string,
  ): Promise<{ success: boolean; message: string }> {
    const canAccess = await this.accessService.canAccess(
      businessId,
      userId,
      'ledger:read',
    );
    if (!canAccess) {
      return { success: false, message: 'Access denied' };
    }

    const intent = this.parseIntent(text);
    const result = await this.executeCommand(businessId, intent);
    await this.smsService.send(phone, `Kaba: ${result}`);
    return { success: true, message: result };
  }
}
