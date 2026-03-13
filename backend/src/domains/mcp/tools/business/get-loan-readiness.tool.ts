import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { LoanReadinessService } from '@/domains/ai/LoanReadinessService';

@Injectable()
export class GetLoanReadinessTool implements IMcpTool {
  readonly name = 'get_loan_readiness';
  readonly description = 'Assess loan readiness based on business financial health';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'pro' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      requestedAmount: { type: 'number', description: 'Loan amount being requested' },
      currency: { type: 'string', description: 'Currency code' },
    },
    required: [],
  };

  constructor(private readonly loanReadinessService: LoanReadinessService) {}

  async execute(_input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const now = new Date();
    const toDate = now.toISOString().slice(0, 10);
    const fromDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);

    const result = await this.loanReadinessService.getScore(ctx.businessId, fromDate, toDate);

    const eligible = result.score >= 3;
    const recommendation = eligible
      ? 'Your business shows good financial health for a loan application.'
      : 'Improve your transaction consistency and revenue before applying.';

    return {
      eligible,
      score: result.score,
      maxScore: result.maxScore,
      reasons: result.suggestions,
      recommendation,
      summary: result.summary,
    };
  }
}
