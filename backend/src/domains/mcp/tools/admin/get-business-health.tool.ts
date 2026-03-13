import { Injectable } from '@nestjs/common';
import { BusinessTrustScoreService } from '@/domains/trust/BusinessTrustScoreService';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';

@Injectable()
export class GetBusinessHealthTool implements IMcpTool {
  readonly name = 'get_business_health';
  readonly description = 'Get financial health metrics and trust score for a specific business';
  readonly scopes = ['admin'] as const;
  readonly tierRequired = 'enterprise' as const;
  readonly inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      businessId: { type: 'string', description: 'Business ID to inspect' },
    },
    required: ['businessId'],
  };

  constructor(private readonly trustScoreService: BusinessTrustScoreService) {}

  async execute(input: Record<string, unknown>, _ctx: McpToolContext): Promise<unknown> {
    const result = await this.trustScoreService.calculate(input['businessId'] as string);
    return {
      businessId: result.businessId,
      trustScore: result.trustScore,
      recommendation: result.recommendation,
      signals: result.breakdown,
    };
  }
}
