import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { BusinessTrustScoreService } from '@/domains/trust/BusinessTrustScoreService';

@Injectable()
export class GetTrustScoreTool implements IMcpTool {
  readonly name = 'get_trust_score';
  readonly description = 'Calculate and return the business trust score used for loan applications';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {},
    required: [],
  };

  constructor(private readonly trustScoreService: BusinessTrustScoreService) {}

  async execute(_input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const result = await this.trustScoreService.calculate(ctx.businessId);
    return {
      trustScore: result.trustScore,
      recommendation: result.recommendation,
      signals: result.breakdown,
    };
  }
}
