import { Injectable } from '@nestjs/common';
import { AdminMetricsService } from '@/domains/admin/AdminMetricsService';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';

@Injectable()
export class GetUsageSummaryTool implements IMcpTool {
  readonly name = 'get_usage_summary';
  readonly description = 'Get AI query usage and feature usage summary across businesses';
  readonly scopes = ['admin'] as const;
  readonly tierRequired = 'enterprise' as const;
  readonly inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max results (default 20)' },
    },
    required: [],
  };

  constructor(private readonly adminMetricsService: AdminMetricsService) {}

  async execute(input: Record<string, unknown>, _ctx: McpToolContext): Promise<unknown> {
    const limit = Math.min(Number(input['limit'] ?? 20), 50);
    const { items } = await this.adminMetricsService.listBusinesses(limit);
    return {
      businesses: items.map((b) => ({
        businessId: b.id,
        name: b.name,
        tier: b.tier,
        countryCode: b.countryCode,
      })),
      total: items.length,
      note: 'Usage tracking per business is available in the admin dashboard.',
    };
  }
}
