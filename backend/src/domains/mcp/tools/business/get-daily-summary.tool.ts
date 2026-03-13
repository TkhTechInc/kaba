import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { ReportService } from '@/domains/reports/ReportService';
import { DebtService } from '@/domains/debts/services/DebtService';

@Injectable()
export class GetDailySummaryTool implements IMcpTool {
  readonly name = 'get_daily_summary';
  readonly description =
    "Get today's financial summary: total sales, expenses, profit, and outstanding debts";
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'free' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {},
    required: [],
  };

  constructor(
    private readonly reportService: ReportService,
    private readonly debtService: DebtService,
  ) {}

  async execute(_input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const today = new Date().toISOString().slice(0, 10);

    let pl: { totalIncome: number; totalExpenses: number; netProfit: number; currency: string } = {
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
      currency: 'XOF',
    };
    let debtResult: { total: number; items: Array<{ debtorName: string; amount: number; currency: string }> } = {
      total: 0,
      items: [],
    };

    try {
      pl = await this.reportService.getPL(ctx.businessId, today, today);
    } catch {
      // Partial data is fine
    }

    try {
      debtResult = await this.debtService.list(ctx.businessId, 1, 5, 'pending');
    } catch {
      // Partial data is fine
    }

    return {
      date: today,
      sales: pl.totalIncome,
      expenses: pl.totalExpenses,
      profit: pl.netProfit,
      currency: pl.currency,
      pendingDebts: {
        count: debtResult.total,
        items: debtResult.items.slice(0, 3).map((d) => ({
          name: d.debtorName,
          amount: d.amount,
          currency: d.currency,
        })),
      },
    };
  }
}
