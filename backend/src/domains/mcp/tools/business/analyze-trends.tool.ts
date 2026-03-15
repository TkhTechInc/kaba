import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { ReportService } from '@/domains/reports/ReportService';
import type { PLReport } from '@/domains/reports/ReportService';

function getDateRanges(
  periodType: 'week' | 'month',
): { periodA: { start: string; end: string }; periodB: { start: string; end: string } } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (periodType === 'week') {
    const endA = new Date(now);
    const startA = new Date(now);
    startA.setDate(startA.getDate() - 6);
    const endB = new Date(startA);
    endB.setDate(endB.getDate() - 1);
    const startB = new Date(endB);
    startB.setDate(startB.getDate() - 6);
    return {
      periodA: { start: startA.toISOString().slice(0, 10), end: endA.toISOString().slice(0, 10) },
      periodB: { start: startB.toISOString().slice(0, 10), end: endB.toISOString().slice(0, 10) },
    };
  }

  const startA = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endA = today;
  const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const startB = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
  const endB = lastMonth.toISOString().slice(0, 10);
  return {
    periodA: { start: startA, end: endA },
    periodB: { start: startB, end: endB },
  };
}

function byCategoryKey(pl: PLReport): Record<string, number> {
  const map: Record<string, number> = {};
  for (const { category, amount, type } of pl.byCategory) {
    const key = `${category}:${type}`;
    map[key] = (map[key] ?? 0) + amount;
  }
  return map;
}

@Injectable()
export class AnalyzeTrendsTool implements IMcpTool {
  readonly name = 'analyze_trends';
  readonly description =
    "Compare two periods (this week vs last week, or this month vs last month) and return revenue, expenses, profit deltas plus category-level breakdown. Use this when the merchant asks 'why did my sales drop?', 'pourquoi mes ventes ont baissé?', or similar analytical questions.";
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      periodType: {
        type: 'string',
        enum: ['week', 'month'],
        description: "Compare 'week' (last 7 days vs previous 7 days) or 'month' (this month vs last month)",
      },
    },
    required: [],
  };

  constructor(private readonly reportService: ReportService) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const periodType = ((input.periodType as string) ?? 'week') as 'week' | 'month';
    const { periodA, periodB } = getDateRanges(periodType);

    const [plA, plB] = await Promise.all([
      this.reportService.getPL(ctx.businessId, periodA.start, periodA.end),
      this.reportService.getPL(ctx.businessId, periodB.start, periodB.end),
    ]);

    const deltaRevenue = plA.totalIncome - plB.totalIncome;
    const deltaExpenses = plA.totalExpenses - plB.totalExpenses;
    const deltaProfit = plA.netProfit - plB.netProfit;
    const deltaPercentRevenue =
      plB.totalIncome > 0 ? Math.round((deltaRevenue / plB.totalIncome) * 100) : (plA.totalIncome > 0 ? 100 : 0);
    const deltaPercentExpenses =
      plB.totalExpenses > 0 ? Math.round((deltaExpenses / plB.totalExpenses) * 100) : (plA.totalExpenses > 0 ? 100 : 0);
    const deltaPercentProfit =
      plB.netProfit !== 0 ? Math.round((deltaProfit / Math.abs(plB.netProfit)) * 100) : (plA.netProfit !== 0 ? 100 : 0);

    const catA = byCategoryKey(plA);
    const catB = byCategoryKey(plB);
    const allKeys = new Set([...Object.keys(catA), ...Object.keys(catB)]);
    const categoryDeltas = Array.from(allKeys)
      .map((key) => {
        const [category, type] = key.split(':');
        const amountA = catA[key] ?? 0;
        const amountB = catB[key] ?? 0;
        const delta = amountA - amountB;
        const deltaPercent = amountB > 0 ? Math.round((delta / amountB) * 100) : (amountA > 0 ? 100 : 0);
        return { category, type, amountA, amountB, delta, deltaPercent };
      })
      .filter((c) => Math.abs(c.delta) > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 10);

    return {
      periodType,
      periodA: { start: periodA.start, end: periodA.end, revenue: plA.totalIncome, expenses: plA.totalExpenses, profit: plA.netProfit },
      periodB: { start: periodB.start, end: periodB.end, revenue: plB.totalIncome, expenses: plB.totalExpenses, profit: plB.netProfit },
      currency: plA.currency,
      deltaRevenue,
      deltaExpenses,
      deltaProfit,
      deltaPercentRevenue,
      deltaPercentExpenses,
      deltaPercentProfit,
      categoryDeltas,
      summaryForLLM:
        `Revenue: ${deltaPercentRevenue >= 0 ? '+' : ''}${deltaPercentRevenue}% (${plA.currency} ${deltaRevenue >= 0 ? '+' : ''}${deltaRevenue.toLocaleString()}). ` +
        `Expenses: ${deltaPercentExpenses >= 0 ? '+' : ''}${deltaPercentExpenses}% (${plA.currency} ${deltaExpenses >= 0 ? '+' : ''}${deltaExpenses.toLocaleString()}). ` +
        `Profit: ${deltaPercentProfit >= 0 ? '+' : ''}${deltaPercentProfit}% (${plA.currency} ${deltaProfit >= 0 ? '+' : ''}${deltaProfit.toLocaleString()}). ` +
        (categoryDeltas.length > 0
          ? `Biggest category changes: ${categoryDeltas.slice(0, 3).map((c) => `${c.category} (${c.type}): ${c.deltaPercent >= 0 ? '+' : ''}${c.deltaPercent}%`).join('; ')}.`
          : ''),
    };
  }
}
