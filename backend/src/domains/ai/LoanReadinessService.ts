import { Inject, Injectable } from '@nestjs/common';
import { AI_LOAN_PROVIDER } from '@/nest/modules/ai/ai.tokens';
import type { ILLMProvider } from './ILLMProvider';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { ReportService } from '@/domains/reports/ReportService';
import { AIProviderError } from '@/shared/errors/DomainError';

export interface LoanReadinessResult {
  score: number;
  maxScore: number;
  suggestions: string[];
  summary: {
    transactionCount: number;
    avgDailyRevenue: number;
    consistencyScore: number;
    hasPositiveTrend: boolean;
  };
}

@Injectable()
export class LoanReadinessService {
  constructor(
    @Inject(AI_LOAN_PROVIDER) private readonly llm: ILLMProvider,
    private readonly ledgerRepo: LedgerRepository,
    private readonly reportService: ReportService,
  ) {}

  async getScore(
    businessId: string,
    fromDate: string,
    toDate: string,
  ): Promise<LoanReadinessResult> {
    const entries = await this.ledgerRepo.listByBusinessAndDateRange(
      businessId,
      fromDate,
      toDate,
    );

    const pl = await this.reportService.getPL(businessId, fromDate, toDate);

    const sales = entries.filter((e) => e.type === 'sale');
    const saleDates = new Set(sales.map((e) => e.date));
    const avgDailyRevenue =
      sales.reduce((s, e) => s + e.amount, 0) / Math.max(1, saleDates.size);

    const daysInPeriod = Math.max(
      1,
      (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (24 * 60 * 60 * 1000),
    );
    const consistencyScore = Math.min(
      100,
      (saleDates.size / Math.min(daysInPeriod, 30)) * 100,
    );
    const hasPositiveTrend = pl.netProfit > 0;

    const prompt = `Business data: ${entries.length} transactions, net profit ${pl.netProfit}, avg daily revenue ${avgDailyRevenue.toFixed(0)}, consistency ${consistencyScore.toFixed(0)}%, positive trend ${hasPositiveTrend}.
Rate loan readiness 1-5 (5=ready). Give 2-3 short suggestions to improve. Return JSON: { score: number, suggestions: string[] }`;

    let response: Awaited<ReturnType<typeof this.llm.generateStructured<{ score: number; suggestions: string[] }>>>;
    try {
      response = await this.llm.generateStructured<{ score: number; suggestions: string[] }>({
        prompt,
        systemPrompt: 'You are a microfinance loan assessor for West African MSMEs. Be practical.',
        jsonSchema: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            suggestions: { type: 'array', items: { type: 'string' } },
          },
          required: ['score', 'suggestions'],
        },
      });
    } catch (llmErr) {
      throw new AIProviderError(
        `Failed to assess loan readiness: ${(llmErr as Error).message ?? 'Unknown error'}`,
      );
    }

    const score = Math.min(5, Math.max(1, Math.round(response.data.score)));
    const suggestions = response.data.suggestions || [];

    return {
      score,
      maxScore: 5,
      suggestions,
      summary: {
        transactionCount: entries.length,
        avgDailyRevenue: Math.round(avgDailyRevenue * 100) / 100,
        consistencyScore: Math.round(consistencyScore),
        hasPositiveTrend,
      },
    };
  }
}
