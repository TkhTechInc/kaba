import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { InvoiceRepository } from '@/domains/invoicing/repositories/InvoiceRepository';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';
import { AI_LEDGER_QA_PROVIDER } from '@/nest/modules/ai/ai.tokens';
import type { ILLMProvider } from '@/domains/ai/ILLMProvider';
import { CashShortageInputSchema, type CashShortageInput } from '../../validation/schemas';
import { McpInputValidationError } from '../../errors/McpErrors';
import { AI_CONFIG, CASH_FLOW_CONFIG } from '@/config/constants';
import { AICostTracker } from '../../services/AICostTracker';

interface CashFlowRisk {
  level: 'low' | 'medium' | 'high';
  shortageDate: string | null;
  daysUntilShortage: number | null;
}

@Injectable()
export class PredictCashShortageTool implements IMcpTool {
  private readonly logger = new Logger(PredictCashShortageTool.name);

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
        description: `Number of days to forecast ahead (default ${CASH_FLOW_CONFIG.DEFAULT_FORECAST_DAYS}, max ${CASH_FLOW_CONFIG.MAX_FORECAST_DAYS})`,
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
    private readonly aiCostTracker: AICostTracker,
  ) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const startTime = Date.now();

    // Validate input
    let validated: CashShortageInput;
    try {
      validated = CashShortageInputSchema.parse(input);
    } catch (err: any) {
      const errors = err.errors?.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      })) ?? [{ field: 'input', message: err.message }];
      throw new McpInputValidationError('predict_cash_shortage', errors);
    }

    this.logger.log('Starting cash shortage prediction', {
      businessId: ctx.businessId,
      daysAhead: validated.daysAhead,
      tier: ctx.tier,
    });

    // Check AI quota before expensive operations
    if (validated.includeRecommendations) {
      const hasQuota = await this.aiCostTracker.checkQuota(ctx.userId!, ctx.tier);
      if (!hasQuota) {
        this.logger.warn('AI quota exceeded, skipping recommendations', {
          userId: ctx.userId,
          tier: ctx.tier,
        });
        validated.includeRecommendations = false;
      }
    }

    // Calculate cash flow forecast
    const forecast = await this.calculateForecast(validated.daysAhead, ctx);

    // Generate AI recommendations if requested and quota available
    let recommendations: string[] | undefined;
    if (validated.includeRecommendations && (forecast.risk.level === 'high' || forecast.risk.level === 'medium')) {
      try {
        recommendations = await this.generateRecommendations(forecast, ctx);
      } catch (err) {
        this.logger.error('Failed to generate recommendations', { error: err });
        recommendations = this.getFallbackRecommendations(forecast.risk.level);
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log('Cash shortage prediction completed', {
      businessId: ctx.businessId,
      riskLevel: forecast.risk.level,
      duration,
    });

    return {
      ...forecast,
      recommendations,
      generatedAt: new Date().toISOString(),
      duration,
    };
  }

  private async calculateForecast(daysAhead: number, ctx: McpToolContext) {
    const today = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - CASH_FLOW_CONFIG.ROLLING_AVERAGE_WINDOW * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    // Get historical data
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

    // Get upcoming expected income
    const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const upcomingInvoices = await this.invoiceRepo.listByBusinessAndDateRange(
      ctx.businessId,
      today,
      futureDate,
    );

    const expectedIncome = upcomingInvoices
      .filter(inv => inv.status === 'pending')
      .reduce((sum, inv) => sum + inv.amount, 0);

    // Get upcoming debts
    const { items: pendingDebts } = await this.debtRepo.listByBusiness(
      ctx.businessId,
      1,
      1000,
      'pending',
    );

    const upcomingDebtPayments = pendingDebts
      .filter(debt => debt.dueDate <= futureDate)
      .reduce((sum, debt) => sum + debt.amount, 0);

    // Forecast
    const projectedExpenses = avgDailyExpenses * daysAhead;
    const projectedSales = avgDailySales * daysAhead;
    const projectedEndBalance =
      balance + projectedSales + expectedIncome - projectedExpenses - upcomingDebtPayments;

    // Calculate risk
    const risk = this.calculateRisk(balance, projectedEndBalance, avgDailySales, avgDailyExpenses, daysAhead);

    return {
      currentBalance: this.round(balance),
      forecast: {
        daysAhead,
        projectedBalance: this.round(projectedEndBalance),
        projectedIncome: this.round(projectedSales + expectedIncome),
        projectedExpenses: this.round(projectedExpenses + upcomingDebtPayments),
        netChange: this.round(projectedEndBalance - balance),
      },
      risk,
      details: {
        avgDailySales: this.round(avgDailySales),
        avgDailyExpenses: this.round(avgDailyExpenses),
        expectedInvoicePayments: this.round(expectedIncome),
        upcomingDebtPayments: this.round(upcomingDebtPayments),
        historicalDays: salesDays.length,
      },
    };
  }

  private calculateRisk(
    currentBalance: number,
    projectedBalance: number,
    avgDailySales: number,
    avgDailyExpenses: number,
    daysAhead: number,
  ): CashFlowRisk {
    let shortageDate: string | null = null;
    let daysUntilShortage: number | null = null;

    // Calculate when balance will hit zero if burn rate continues
    if (avgDailyExpenses > avgDailySales) {
      const dailyBurn = avgDailyExpenses - avgDailySales;
      const calculatedDays = Math.floor(currentBalance / dailyBurn);
      if (calculatedDays < daysAhead) {
        daysUntilShortage = calculatedDays;
        shortageDate = new Date(Date.now() + calculatedDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
      }
    }

    // Determine risk level
    const level =
      projectedBalance < CASH_FLOW_CONFIG.HIGH_RISK_THRESHOLD
        ? 'high'
        : projectedBalance < currentBalance * CASH_FLOW_CONFIG.MEDIUM_RISK_THRESHOLD
        ? 'medium'
        : 'low';

    return { level, shortageDate, daysUntilShortage };
  }

  private async generateRecommendations(forecast: any, ctx: McpToolContext): Promise<string[]> {
    // Sanitize inputs to prevent prompt injection
    const sanitized = {
      balance: this.sanitizeNumber(forecast.currentBalance),
      projected: this.sanitizeNumber(forecast.forecast.projectedBalance),
      sales: this.sanitizeNumber(forecast.details.avgDailySales),
      expenses: this.sanitizeNumber(forecast.details.avgDailyExpenses),
      income: this.sanitizeNumber(forecast.details.expectedInvoicePayments),
      debts: this.sanitizeNumber(forecast.details.upcomingDebtPayments),
      risk: forecast.risk.level,
    };

    // Structured prompt with clear constraints
    const systemPrompt = `You are a financial advisor for small businesses in West Africa. Provide cash flow recommendations.

Rules:
- Output ONLY a valid JSON array of strings
- Maximum 5 recommendations
- Each recommendation maximum 100 characters
- Focus on actionable steps
- No markdown, no explanations, just the JSON array`;

    const userPrompt = `Cash flow analysis:
Current: ${sanitized.balance}
Projected (${forecast.forecast.daysAhead}d): ${sanitized.projected}
Daily sales: ${sanitized.sales}
Daily expenses: ${sanitized.expenses}
Expected payments: ${sanitized.income}
Upcoming bills: ${sanitized.debts}
Risk: ${sanitized.risk}

Generate 3-5 specific recommendations:`;

    const aiStartTime = Date.now();
    const response = await Promise.race([
      this.llm.generateText(userPrompt, {
        maxTokens: AI_CONFIG.CASH_PREDICTION.MAX_TOKENS,
        temperature: AI_CONFIG.CASH_PREDICTION.TEMPERATURE,
        systemPrompt,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI timeout')), AI_CONFIG.CASH_PREDICTION.TIMEOUT_MS),
      ),
    ]);

    const aiDuration = Date.now() - aiStartTime;

    // Track AI usage
    const tokenCount = response.length / 4; // Rough estimate
    const estimatedCost = (tokenCount / 1000000) * 3; // ~$3 per 1M tokens for Llama 3.3
    await this.aiCostTracker.recordUsage(ctx.userId!, ctx.tier, tokenCount, estimatedCost, 'cash_shortage_prediction');

    this.logger.debug('AI recommendations generated', {
      duration: aiDuration,
      tokens: tokenCount,
      cost: estimatedCost,
    });

    // Parse and validate response
    const recommendations = this.parseRecommendations(response);
    return recommendations.slice(0, 5); // Max 5
  }

  private parseRecommendations(response: string): string[] {
    try {
      // Try to extract JSON array
      const jsonMatch = response.match(/\[([\s\S]*?)\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
          return parsed.map(r => r.slice(0, 100)); // Truncate to 100 chars
        }
      }

      // Fallback: split by newlines/bullets
      return response
        .split(/\n/)
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .filter(line => line.length > 10 && line.length < 200)
        .slice(0, 5);
    } catch (err) {
      this.logger.error('Failed to parse AI recommendations', { response, error: err });
      throw err;
    }
  }

  private getFallbackRecommendations(riskLevel: 'low' | 'medium' | 'high'): string[] {
    if (riskLevel === 'high') {
      return [
        'Follow up immediately on all overdue invoices',
        'Negotiate extended payment terms with suppliers',
        'Consider short-term financing or overdraft facility',
        'Delay non-essential expenses until cash improves',
        'Offer early payment discounts to customers',
      ];
    }

    return [
      'Monitor cash flow weekly instead of monthly',
      'Contact customers with invoices due in next 7 days',
      'Review and reduce unnecessary recurring expenses',
      'Build a cash reserve equal to 2 weeks of expenses',
    ];
  }

  private sanitizeNumber(value: number): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100) / 100;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
