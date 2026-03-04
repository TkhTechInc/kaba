import { Inject, Injectable } from '@nestjs/common';
import { AI_LLM_PROVIDER } from '@/nest/modules/ai/ai.tokens';
import type { ILLMProvider } from './ILLMProvider';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { FeatureService } from '@/domains/features/FeatureService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { UsageRepository } from '@/domains/usage/UsageRepository';
import { ValidationError } from '@/shared/errors/DomainError';

export interface AIQueryResult {
  answer: string;
  data?: Record<string, unknown>;
  chartData?: Array<{ label: string; value: number }>;
}

export interface CashFlowForecastResult {
  forecast: Array<{ date: string; predictedInflow: number; predictedOutflow: number }>;
  totalPredictedInflow: number;
  totalPredictedOutflow: number;
  currency: string;
}

@Injectable()
export class AIQueryService {
  constructor(
    @Inject(AI_LLM_PROVIDER) private readonly llm: ILLMProvider,
    private readonly ledgerRepo: LedgerRepository,
    private readonly featureService: FeatureService,
    private readonly businessRepo: BusinessRepository,
    private readonly usageRepo: UsageRepository,
  ) {}

  async ask(
    businessId: string,
    query: string,
  ): Promise<AIQueryResult> {
    const business = await this.businessRepo.getOrCreate(businessId, 'free');
    const count = await this.usageRepo.getAiQueryCount(businessId);
    if (!this.featureService.isWithinLimit('ai_query', business.tier, count)) {
      const limit = this.featureService.getLimit('ai_query', business.tier);
      throw new ValidationError(
        `AI query limit reached (${count}/${limit} this month). Upgrade your plan for more.`,
      );
    }

    const entries = await this.ledgerRepo.listAllByBusinessForBalance(businessId);

    const summary = this.summarizeEntries(entries);
    const prompt = `User question: "${query}"\n\nBusiness data (last ${entries.length} transactions):\n${JSON.stringify(summary, null, 2)}\n\nAnswer the question concisely. If they ask for a number, provide it. If they ask "how much on X", sum expenses in that category.`;

    const response = await this.llm.generateText({
      prompt,
      systemPrompt: 'You are a helpful accounting assistant for a small business in West Africa. Answer based only on the provided data. Be concise.',
    });

    let chartData: Array<{ label: string; value: number }> | undefined;
    if (query.toLowerCase().includes('category') || query.toLowerCase().includes('breakdown')) {
      chartData = Object.entries(summary.byCategory).map(([label, value]) => ({
        label,
        value: value as number,
      }));
    }

    await this.usageRepo.incrementAiQueries(businessId);

    return {
      answer: response.text,
      data: summary,
      chartData,
    };
  }

  async getCashFlowForecast(
    businessId: string,
    fromDate: string,
    days: number = 30,
  ): Promise<CashFlowForecastResult> {
    const entries = await this.ledgerRepo.listAllByBusinessForBalance(businessId);
    const recent = entries.filter((e) => e.date >= fromDate).slice(-90);

    const avgDailyInflow =
      recent.filter((e) => e.type === 'sale').reduce((s, e) => s + e.amount, 0) /
      Math.max(1, new Set(recent.filter((e) => e.type === 'sale').map((e) => e.date)).size);
    const avgDailyOutflow =
      recent.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0) /
      Math.max(1, new Set(recent.filter((e) => e.type === 'expense').map((e) => e.date)).size);

    const forecast: Array<{ date: string; predictedInflow: number; predictedOutflow: number }> = [];
    let totalIn = 0;
    let totalOut = 0;

    for (let i = 0; i < days; i++) {
      const d = new Date(fromDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const inflow = Math.round(avgDailyInflow * 100) / 100;
      const outflow = Math.round(avgDailyOutflow * 100) / 100;
      forecast.push({ date: dateStr, predictedInflow: inflow, predictedOutflow: outflow });
      totalIn += inflow;
      totalOut += outflow;
    }

    return {
      forecast,
      totalPredictedInflow: totalIn,
      totalPredictedOutflow: totalOut,
      currency: entries[0]?.currency ?? 'NGN',
    };
  }

  private summarizeEntries(entries: Array<{ type: string; amount: number; category: string; date: string; currency: string }>) {
    let totalIncome = 0;
    let totalExpenses = 0;
    const byCategory: Record<string, number> = {};

    for (const e of entries) {
      const cat = e.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = 0;
      byCategory[cat] += e.amount;

      if (e.type === 'sale') totalIncome += e.amount;
      else totalExpenses += e.amount;
    }

    return {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      transactionCount: entries.length,
      byCategory,
      dateRange: entries.length
        ? { min: entries[0]?.date, max: entries[entries.length - 1]?.date }
        : null,
    };
  }
}
