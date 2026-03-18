import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { InvoiceRepository } from '@/domains/invoicing/repositories/InvoiceRepository';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';
import { AI_LEDGER_QA_PROVIDER } from '@/nest/modules/ai/ai.tokens';
import { Inject } from '@nestjs/common';
import type { ILLMProvider } from '@/domains/ai/ILLMProvider';

@Injectable()
export class PredictCashShortageTool implements IMcpTool {
  readonly name = 'predict_cash_shortage';
  readonly description =
    'AI-powered cash flow analysis that predicts potential cash shortages in the next 30 days and provides recommendations';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'pro' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      daysAhead: {
        type: 'number',
        description: 'Number of days to forecast ahead (default 30, max 90)',
      },
      includeRecommendations: {
        type: 'boolean',
        description: 'Include AI-generated recommendations (default true)',
      },
    },
  };

  constructor(
    private readonly ledgerRepo: LedgerRepository,
    private readonly invoiceRepo: InvoiceRepository,
    private readonly debtRepo: DebtRepository,
    @Inject(AI_LEDGER_QA_PROVIDER) private readonly llm: ILLMProvider,
  ) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const daysAhead = Math.min((input.daysAhead as number) ?? 30, 90);
    const includeRecommendations = input.includeRecommendations !== false;

    // Get historical data (last 90 days)
    const today = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const historicalEntries = await this.ledgerRepo.listByBusinessAndDateRange(
      ctx.businessId,
      startDate,
      today,
    );

    // Calculate historical averages
    const salesByDay: Record<string, number> = {};
    const expensesByDay: Record<string, number> = {};

    for (const entry of historicalEntries) {
      const date = entry.entryDate;
      if (entry.type === 'sale') {
        salesByDay[date] = (salesByDay[date] ?? 0) + entry.amount;
      } else {
        expensesByDay[date] = (expensesByDay[date] ?? 0) + entry.amount;
      }
    }

    const salesDays = Object.values(salesByDay);
    const expenseDays = Object.values(expensesByDay);

    const avgDailySales =
      salesDays.length > 0 ? salesDays.reduce((a, b) => a + b, 0) / salesDays.length : 0;
    const avgDailyExpenses =
      expenseDays.length > 0 ? expenseDays.reduce((a, b) => a + b, 0) / expenseDays.length : 0;

    // Get current balance
    const balance = await this.ledgerRepo.getBalance(ctx.businessId);

    // Get upcoming expected income (unpaid invoices due in next daysAhead)
    const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const upcomingInvoices = await this.invoiceRepo.listByBusinessAndDateRange(
      ctx.businessId,
      today,
      futureDate,
    );

    const expectedIncome = upcomingInvoices
      .filter((inv) => inv.status === 'pending')
      .reduce((sum, inv) => sum + inv.amount, 0);

    // Get upcoming debts to be paid
    const { items: pendingDebts } = await this.debtRepo.listByBusiness(
      ctx.businessId,
      1,
      1000,
      'pending',
    );

    const upcomingDebtPayments = pendingDebts
      .filter((debt) => debt.dueDate <= futureDate)
      .reduce((sum, debt) => sum + debt.amount, 0);

    // Forecast cash position
    const projectedExpenses = avgDailyExpenses * daysAhead;
    const projectedSales = avgDailySales * daysAhead;
    const projectedEndBalance =
      balance + projectedSales + expectedIncome - projectedExpenses - upcomingDebtPayments;

    const shortageRisk = projectedEndBalance < 0 ? 'high' : projectedEndBalance < balance * 0.2 ? 'medium' : 'low';

    // Calculate shortage date if trending negative
    let shortageDate: string | null = null;
    if (avgDailyExpenses > avgDailySales) {
      const dailyBurn = avgDailyExpenses - avgDailySales;
      const daysUntilShortage = Math.floor(balance / dailyBurn);
      if (daysUntilShortage < daysAhead) {
        shortageDate = new Date(Date.now() + daysUntilShortage * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
      }
    }

    let recommendations: string[] = [];

    if (includeRecommendations && (shortageRisk === 'high' || shortageRisk === 'medium')) {
      try {
        const prompt = `Based on this cash flow analysis for a small business, provide 3-5 specific, actionable recommendations to avoid cash shortage:

Current Balance: ${balance}
Projected ${daysAhead}-day Balance: ${projectedEndBalance}
Average Daily Sales: ${avgDailySales}
Average Daily Expenses: ${avgDailyExpenses}
Expected Invoice Payments: ${expectedIncome}
Upcoming Debt Payments: ${upcomingDebtPayments}
Risk Level: ${shortageRisk}

Provide recommendations as a JSON array of strings. Keep each recommendation under 100 characters.`;

        const response = await this.llm.generateText(prompt, {
          maxTokens: 500,
          temperature: 0.7,
        });

        // Try to parse JSON array from response
        const jsonMatch = response.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          recommendations = JSON.parse(jsonMatch[0]) as string[];
        } else {
          // Fallback: split by newlines
          recommendations = response
            .split('\n')
            .filter((line) => line.trim().length > 0)
            .slice(0, 5);
        }
      } catch (err) {
        console.error('Failed to generate cash shortage recommendations:', err);
        // Fallback recommendations
        if (shortageRisk === 'high') {
          recommendations = [
            'Follow up on overdue invoices immediately',
            'Negotiate payment terms with suppliers',
            'Consider short-term financing options',
            'Reduce non-essential expenses',
          ];
        }
      }
    }

    return {
      currentBalance: Math.round(balance * 100) / 100,
      forecast: {
        daysAhead,
        projectedBalance: Math.round(projectedEndBalance * 100) / 100,
        projectedIncome: Math.round((projectedSales + expectedIncome) * 100) / 100,
        projectedExpenses: Math.round((projectedExpenses + upcomingDebtPayments) * 100) / 100,
        netChange: Math.round((projectedEndBalance - balance) * 100) / 100,
      },
      risk: {
        level: shortageRisk,
        shortageDate,
        daysUntilShortage: shortageDate
          ? Math.floor(
              (new Date(shortageDate).getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000),
            )
          : null,
      },
      details: {
        avgDailySales: Math.round(avgDailySales * 100) / 100,
        avgDailyExpenses: Math.round(avgDailyExpenses * 100) / 100,
        expectedInvoicePayments: Math.round(expectedIncome * 100) / 100,
        upcomingDebtPayments: Math.round(upcomingDebtPayments * 100) / 100,
      },
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    };
  }
}
