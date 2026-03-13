import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { ReportService } from '@/domains/reports/ReportService';

@Injectable()
export class GetCashFlowForecastTool implements IMcpTool {
  readonly name = 'get_cash_flow_forecast';
  readonly description = 'Get AI-powered cash flow forecast for the next 30 days';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'pro' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      days: { type: 'number', description: 'Forecast horizon in days (default 30)' },
    },
    required: [],
  };

  constructor(private readonly reportService: ReportService) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const forecastDays = Math.min((input.days as number) ?? 30, 90);
    const now = new Date();

    const historicalFrom = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
    const historicalTo = now.toISOString().slice(0, 10);

    const cashFlow = await this.reportService.getCashFlow(ctx.businessId, historicalFrom, historicalTo);

    const periodDays = cashFlow.daily?.length ?? 90;
    const avgDailyInflow = periodDays > 0 ? cashFlow.totalInflows / Math.max(periodDays, 1) : 0;
    const avgDailyOutflow = periodDays > 0 ? cashFlow.totalOutflows / Math.max(periodDays, 1) : 0;
    const projectedNetFlow = (avgDailyInflow - avgDailyOutflow) * forecastDays;

    const forecastEnd = new Date(now.getTime() + forecastDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return {
      forecast: {
        projectedInflow: Math.round(avgDailyInflow * forecastDays * 100) / 100,
        projectedOutflow: Math.round(avgDailyOutflow * forecastDays * 100) / 100,
        projectedNetFlow: Math.round(projectedNetFlow * 100) / 100,
        currentBalance: cashFlow.closingBalance,
        projectedClosingBalance: Math.round((cashFlow.closingBalance + projectedNetFlow) * 100) / 100,
      },
      currency: cashFlow.currency,
      period: { start: historicalTo, end: forecastEnd },
      confidence: 'medium',
      note: `Forecast based on ${periodDays} days of historical data using average daily cash flow.`,
    };
  }
}
