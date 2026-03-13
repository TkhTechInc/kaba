import { Injectable } from '@nestjs/common';
import { AdminMetricsService } from '@/domains/admin/AdminMetricsService';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';

@Injectable()
export class ListBusinessesTool implements IMcpTool {
  readonly name = 'list_businesses';
  readonly description = 'List businesses on the platform with optional filtering by tier or country';
  readonly scopes = ['admin'] as const;
  readonly tierRequired = 'enterprise' as const;
  readonly inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max results (default 20, max 50)' },
      tier: { type: 'string', enum: ['free', 'starter', 'pro', 'enterprise'], description: 'Filter by tier' },
      countryCode: { type: 'string', description: 'Filter by ISO 3166-1 alpha-2 country code' },
    },
    required: [],
  };

  constructor(private readonly adminMetricsService: AdminMetricsService) {}

  async execute(input: Record<string, unknown>, _ctx: McpToolContext): Promise<unknown> {
    const limit = Math.min(Number(input['limit'] ?? 20), 50);
    const { items } = await this.adminMetricsService.listBusinesses(limit);

    const tierFilter = input['tier'] as string | undefined;
    const countryFilter = input['countryCode'] as string | undefined;

    return items
      .filter((b) => !tierFilter || b.tier === tierFilter)
      .filter((b) => !countryFilter || b.countryCode === countryFilter)
      .map((b) => ({
        businessId: b.id,
        name: b.name,
        tier: b.tier,
        countryCode: b.countryCode,
        currency: b.currency,
        createdAt: b.createdAt,
      }));
  }
}
