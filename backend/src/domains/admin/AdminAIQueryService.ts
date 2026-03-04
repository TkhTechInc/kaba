import { Inject, Injectable } from '@nestjs/common';
import { AI_LLM_PROVIDER } from '@/nest/modules/ai/ai.tokens';
import type { ILLMProvider } from '@/domains/ai/ILLMProvider';
import { AdminMetricsService } from './AdminMetricsService';

@Injectable()
export class AdminAIQueryService {
  constructor(
    @Inject(AI_LLM_PROVIDER) private readonly llm: ILLMProvider,
    private readonly metricsService: AdminMetricsService,
  ) {}

  async query(query: string): Promise<{ answer: string }> {
    const [metrics, summary] = await Promise.all([
      this.metricsService.getMetrics(),
      this.metricsService.getSummary(),
    ]);

    const context = {
      metrics: {
        businessesCount: metrics.businessesCount,
        ledgerEntriesCount: metrics.ledgerEntriesCount,
        invoicesCount: metrics.invoicesCount,
      },
      summary: {
        ...summary,
      },
    };

    const prompt = `Context (system metrics and summary):\n${JSON.stringify(context, null, 2)}\n\nAdmin question: "${query}"\n\nAnswer based only on the provided metrics and summary. Be concise.`;

    const response = await this.llm.generateText({
      prompt,
      systemPrompt: 'You are an admin dashboard assistant. Answer questions about system metrics using only the provided data. Be concise and factual.',
    });

    return { answer: response.text };
  }
}
