import { Injectable } from '@nestjs/common';
import { AdminMetricsService } from '@/domains/admin/AdminMetricsService';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';

@Injectable()
export class GetPlatformMetricsTool implements IMcpTool {
  readonly name = 'get_platform_metrics';
  readonly description = 'Get overall platform metrics including total businesses, revenue, and activity';
  readonly scopes = ['admin'] as const;
  readonly tierRequired = 'enterprise' as const;
  readonly inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: {},
    required: [],
  };

  constructor(private readonly adminMetricsService: AdminMetricsService) {}

  async execute(_input: Record<string, unknown>, _ctx: McpToolContext): Promise<unknown> {
    return this.adminMetricsService.getSummary();
  }
}
