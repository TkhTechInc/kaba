import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { ReportService } from '@/domains/reports/ReportService';

@Injectable()
export class GetProfitLossTool implements IMcpTool {
  readonly name = 'get_profit_loss';
  readonly description =
    'Get profit and loss report for a date range. Defaults to current month if no dates provided.';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      fromDate: { type: 'string', description: 'Start date YYYY-MM-DD (defaults to start of current month)' },
      toDate: { type: 'string', description: 'End date YYYY-MM-DD (defaults to today)' },
    },
    required: [],
  };

  constructor(private readonly reportService: ReportService) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const now = new Date();
    const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const defaultTo = now.toISOString().slice(0, 10);

    const fromDate = (input.fromDate as string) ?? defaultFrom;
    const toDate = (input.toDate as string) ?? defaultTo;

    const pl = await this.reportService.getPL(ctx.businessId, fromDate, toDate);
    return {
      totalIncome: pl.totalIncome,
      totalExpenses: pl.totalExpenses,
      netProfit: pl.netProfit,
      currency: pl.currency,
      period: pl.period,
    };
  }
}
